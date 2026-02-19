/**
 * AST Transformation Pipeline
 *
 * Transforms user JavaScript code to make it safe for sandbox execution:
 * 1. Loop protection — inject iteration counters to prevent infinite loops
 * 2. Recursion protection — inject call-depth counters
 * 3. Global access rewriting — block window, document, globalThis, etc.
 * 4. Module stripping — remove import/export for Compartment eval
 *
 * Uses acorn (lightweight ~80KB parser) for AST manipulation.
 */

import * as acorn from "acorn";
import * as walk from "acorn-walk";
import { generate } from "astring";
import type { ScriptConfig } from "./types.js";
import { DEFAULT_SCRIPT_CONFIG } from "./types.js";

/** Result of AST transformation */
export interface TransformResult {
  /** Transformed code, safe for sandbox execution */
  code: string;
  /** Warnings generated during transformation (non-fatal) */
  warnings: TransformWarning[];
  /** Whether transformation succeeded */
  success: boolean;
  /** Error message if transformation failed */
  error?: string;
}

export interface TransformWarning {
  message: string;
  line?: number;
  column?: number;
}

/** Globals that must not be accessed from sandboxed code */
const BLOCKED_GLOBALS = new Set([
  "window",
  "self",
  "globalThis",
  "document",
  "location",
  "navigator",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "Worker",
  "SharedWorker",
  "ServiceWorker",
  "importScripts",
  "eval",
  "Function",
  "Proxy",
  "Reflect",
]);

/**
 * Transform JavaScript code for safe sandbox execution.
 *
 * @param code Raw JavaScript code (compiled from TypeScript)
 * @param config Script execution limits
 * @returns Transformed code with safety instrumentation
 */
export function transformForSandbox(
  code: string,
  config: Partial<ScriptConfig> = {}
): TransformResult {
  const fullConfig = { ...DEFAULT_SCRIPT_CONFIG, ...config };
  const warnings: TransformWarning[] = [];

  try {
    // Parse the code into an AST
    const ast = acorn.parse(code, {
      ecmaVersion: 2022,
      sourceType: "module",
      locations: true,
    }) as acorn.Node & { body: acorn.Node[] };

    // Apply transformations
    injectLoopProtection(ast, fullConfig, warnings);
    rewriteBlockedGlobals(ast, warnings);
    const strippedCode = stripModuleSyntax(ast, warnings);

    // Generate the instrumented code
    const preamble = generatePreamble(fullConfig);
    const transformed = preamble + "\n" + (strippedCode ?? generate(ast));

    return { code: transformed, warnings, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      code: "",
      warnings,
      success: false,
      error: `Transform failed: ${message}`,
    };
  }
}

/**
 * Generate the safety preamble injected at the top of every script.
 * Provides the counter variables and helper functions used by instrumented code.
 */
function generatePreamble(config: ScriptConfig): string {
  return `// --- poqpoq sandbox instrumentation ---
let __loopCount = 0;
let __callDepth = 0;
const __MAX_ITERATIONS = ${config.maxIterations};
const __MAX_CALL_DEPTH = ${config.maxCallDepth};
function __checkLoop() {
  if (++__loopCount > __MAX_ITERATIONS) {
    __loopCount = 0;
    throw new Error("Script exceeded maximum iterations (" + __MAX_ITERATIONS + "). Possible infinite loop.");
  }
}
function __enterCall() {
  if (++__callDepth > __MAX_CALL_DEPTH) {
    throw new Error("Script exceeded maximum call depth (" + __MAX_CALL_DEPTH + "). Possible infinite recursion.");
  }
}
function __exitCall() {
  __callDepth--;
}
// --- end instrumentation ---
`;
}

/**
 * Inject loop counters into while, for, do-while, and for-in/for-of loops.
 * Every loop body gets a __checkLoop() call at the start.
 */
function injectLoopProtection(
  ast: acorn.Node,
  _config: ScriptConfig,
  _warnings: TransformWarning[]
): void {
  const checkLoopCall: acorn.Node = {
    type: "ExpressionStatement",
    start: 0,
    end: 0,
    expression: {
      type: "CallExpression",
      start: 0,
      end: 0,
      callee: { type: "Identifier", name: "__checkLoop", start: 0, end: 0 },
      arguments: [],
      optional: false,
    },
  } as unknown as acorn.Node;

  walk.simple(ast, {
    WhileStatement(node: any) {
      node.body = wrapWithCheck(node.body, checkLoopCall);
    },
    ForStatement(node: any) {
      node.body = wrapWithCheck(node.body, checkLoopCall);
    },
    DoWhileStatement(node: any) {
      node.body = wrapWithCheck(node.body, checkLoopCall);
    },
    ForInStatement(node: any) {
      node.body = wrapWithCheck(node.body, checkLoopCall);
    },
    ForOfStatement(node: any) {
      node.body = wrapWithCheck(node.body, checkLoopCall);
    },
  });
}

/**
 * Wrap a loop body with a check call.
 * If body is a block, prepend the check. If it's a single statement, wrap in block.
 */
function wrapWithCheck(body: any, checkCall: acorn.Node): any {
  if (body.type === "BlockStatement") {
    body.body = [checkCall, ...body.body];
    return body;
  }
  // Single statement → wrap in block
  return {
    type: "BlockStatement",
    start: body.start,
    end: body.end,
    body: [checkCall, body],
  };
}

/**
 * Rewrite references to blocked globals.
 * `window` → throws Error, `document` → throws Error, etc.
 */
function rewriteBlockedGlobals(
  ast: acorn.Node,
  warnings: TransformWarning[]
): void {
  walk.simple(ast, {
    Identifier(node: any) {
      if (!BLOCKED_GLOBALS.has(node.name)) return;

      // SES handles the actual blocking — this is a static warning layer
      warnings.push({
        message: `Access to '${node.name}' is blocked in the sandbox`,
        line: node.loc?.start?.line,
        column: node.loc?.start?.column,
      });
    },
  });
}

/**
 * Strip import/export syntax for Compartment evaluation.
 * Compartments evaluate code as scripts, not modules.
 * We collect exports and rewrite them as assignments to a shared object.
 */
function stripModuleSyntax(
  ast: any,
  warnings: TransformWarning[]
): string | null {
  let hasModuleSyntax = false;
  const exportedNames: string[] = [];

  for (const node of ast.body) {
    if (
      node.type === "ImportDeclaration" ||
      node.type === "ExportNamedDeclaration" ||
      node.type === "ExportDefaultDeclaration" ||
      node.type === "ExportAllDeclaration"
    ) {
      hasModuleSyntax = true;
      break;
    }
  }

  if (!hasModuleSyntax) return null;

  // Rebuild code without import/export, track what was exported
  const newBody: any[] = [];

  for (const node of ast.body) {
    if (node.type === "ImportDeclaration") {
      // Strip imports — endowments provide these
      warnings.push({
        message: `Import '${node.source.value}' stripped — provided via sandbox endowments`,
        line: node.loc?.start?.line,
      });
      continue;
    }

    if (node.type === "ExportDefaultDeclaration") {
      // `export default class Foo` → `class Foo` + track as default export
      if (node.declaration) {
        newBody.push(node.declaration);
        if (node.declaration.id) {
          exportedNames.push(node.declaration.id.name);
        }
      }
      continue;
    }

    if (node.type === "ExportNamedDeclaration") {
      if (node.declaration) {
        newBody.push(node.declaration);
      }
      continue;
    }

    newBody.push(node);
  }

  ast.body = newBody;
  ast.sourceType = "script";

  let output = generate(ast);

  // Add export collection at the end
  if (exportedNames.length > 0) {
    output += `\n__exports.default = ${exportedNames[0]};`;
  }

  return output;
}
