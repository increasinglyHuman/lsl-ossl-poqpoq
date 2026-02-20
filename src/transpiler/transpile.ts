/**
 * LSL Transpiler — Main entry point.
 *
 * Wires lexer → parser → code generator into a single `transpile()` call.
 * Also re-exports individual pipeline stages for advanced use.
 */

import { tokenize } from "./lexer.js";
import { parse } from "./parser.js";
import { generate } from "./codegen.js";
import type { TranspileOptions, TranspileResult } from "./types.js";

/**
 * Preprocess LSL source to handle common real-world artifacts:
 * - HTML entities from web-scraped scripts (&lt; → <, &gt; → >, etc.)
 * - Git merge conflict markers (<<<<<<< / ======= / >>>>>>>)
 */
function preprocess(source: string): string {
  let s = source;

  // Decode HTML entities (common in web-scraped scripts)
  if (s.includes("&lt;") || s.includes("&gt;") || s.includes("&amp;")) {
    s = s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  }

  // Strip git merge conflict markers (keep "ours" side)
  // Handle both \n and \r\n line endings
  if (s.includes("<<<<<<<")) {
    s = s.replace(/<{7}[^\r\n]*\r?\n([\s\S]*?)={7}\r?\n[\s\S]*?>{7}[^\r\n]*/g, "$1");
  }

  return s;
}

/**
 * Transpile LSL source code to TypeScript.
 *
 * @param source   Raw LSL source text
 * @param options  Optional configuration (className, filename, etc.)
 * @returns        TranspileResult with generated code and diagnostics
 */
export function transpile(source: string, options?: TranspileOptions): TranspileResult {
  try {
    const ast = parse(preprocess(source));
    return generate(ast, options);
  } catch (err) {
    return {
      code: "",
      success: false,
      diagnostics: [
        {
          severity: "error",
          message: err instanceof Error ? err.message : String(err),
        },
      ],
      className: options?.className ?? "LSLScript",
    };
  }
}

// Re-export pipeline stages
export { tokenize } from "./lexer.js";
export { parse } from "./parser.js";
export { generate } from "./codegen.js";
export { TypeTracker } from "./type-tracker.js";
export { FunctionResolver } from "./function-resolver.js";
