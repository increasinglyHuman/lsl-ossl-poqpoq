/**
 * LSL Code Generator — Walks AST and emits TypeScript.
 *
 * Two-pass design:
 *   Pass 1: Scan for async requirements, collect imports/helpers needed
 *   Pass 2: Emit TypeScript source with proper indentation
 *
 * Output extends WorldScript, uses states object pattern.
 */

import type {
  LSLScript,
  StateDeclaration,
  EventHandler,
  FunctionDeclaration,
  VariableDeclaration,
  Statement,
  Expression,
  LSLType,
  TranspileOptions,
  TranspileResult,
} from "./types.js";
import type { Diagnostic } from "./errors.js";
import { TypeTracker } from "./type-tracker.js";
import { FunctionResolver } from "./function-resolver.js";
import { LSL_CONSTANTS, CONSTANTS_REQUIRING_IMPORTS } from "./constants.js";
import { EVENT_NAME_MAP, DETECTED_EVENTS } from "./event-map.js";

// ============================================================
// Type mapping
// ============================================================

function lslTypeToTS(type: LSLType): string {
  switch (type) {
    case "integer": return "number";
    case "float": return "number";
    case "string": return "string";
    case "key": return "string";
    case "vector": return "Vector3";
    case "rotation": return "Quaternion";
    case "list": return "any[]";
    case "void": return "void";
    default: return "any";
  }
}

function defaultValue(type: LSLType): string {
  switch (type) {
    case "integer": return "0";
    case "float": return "0.0";
    case "string": return '""';
    case "key": return '""';
    case "vector": return "Vector3.ZERO";
    case "rotation": return "Quaternion.IDENTITY";
    case "list": return "[]";
    default: return "undefined";
  }
}

// ============================================================
// Code Generator
// ============================================================

export class CodeGenerator {
  private ast: LSLScript;
  private options: TranspileOptions;
  private className: string;
  private typeTracker: TypeTracker;
  private resolver: FunctionResolver;
  private diagnostics: Diagnostic[] = [];

  // Collected during scan pass
  private asyncFunctions = new Set<string>();
  private usedConstants = new Set<string>();
  private needsDetected = new Map<string, boolean>(); // eventKey → needs detected[]
  private usedHelpers = new Set<string>();
  private usedImports = new Set<string>();

  constructor(ast: LSLScript, options: TranspileOptions = {}) {
    this.ast = ast;
    this.options = options;
    this.className = options.className ?? this.deriveClassName();
    this.typeTracker = new TypeTracker();
    this.resolver = new FunctionResolver();
  }

  /** Generate TypeScript from the AST */
  generate(): TranspileResult {
    try {
      // Register globals in type tracker
      this.typeTracker.registerGlobals(this.ast.globals);

      // Pass 1: Scan
      this.scanForAsync();
      this.scanForDetected();
      this.scanForConstantsAndImports();

      // Pass 2: Emit
      const body = this.emitClassBody();
      const imports = this.emitImports();
      const helpers = this.emitHelpers();

      const parts: string[] = [];
      if (imports) parts.push(imports);
      if (helpers) parts.push(helpers);
      parts.push(body);

      return {
        code: parts.join("\n\n") + "\n",
        success: true,
        diagnostics: this.diagnostics,
        className: this.className,
        ast: this.options.includeAst ? this.ast : undefined,
      };
    } catch (err) {
      return {
        code: "",
        success: false,
        diagnostics: [
          ...this.diagnostics,
          {
            severity: "error",
            message: err instanceof Error ? err.message : String(err),
          },
        ],
        className: this.className,
      };
    }
  }

  // === Pass 1: Scan ===

  private scanForAsync(): void {
    // Mark event handlers and functions that directly call async built-ins
    for (const global of this.ast.globals) {
      if (global.type === "FunctionDeclaration") {
        if (this.bodyCallsAsync(global.body)) {
          this.asyncFunctions.add(global.name);
        }
      }
    }

    // Propagate: if funcA calls funcB and funcB is async, funcA is async too
    let changed = true;
    while (changed) {
      changed = false;
      for (const global of this.ast.globals) {
        if (global.type === "FunctionDeclaration" && !this.asyncFunctions.has(global.name)) {
          if (this.bodyCallsUserAsync(global.body)) {
            this.asyncFunctions.add(global.name);
            changed = true;
          }
        }
      }
    }
  }

  private bodyCallsAsync(body: Statement[]): boolean {
    for (const stmt of body) {
      if (this.statementCallsAsync(stmt)) return true;
    }
    return false;
  }

  private statementCallsAsync(stmt: Statement): boolean {
    switch (stmt.type) {
      case "EmptyStatement":
        return false;
      case "ExpressionStatement":
        return this.exprCallsAsync(stmt.expression);
      case "IfStatement":
        return (
          this.exprCallsAsync(stmt.condition) ||
          this.statementCallsAsync(stmt.consequent) ||
          (stmt.alternate !== null && this.statementCallsAsync(stmt.alternate))
        );
      case "WhileStatement":
        return this.exprCallsAsync(stmt.condition) || this.statementCallsAsync(stmt.body);
      case "DoWhileStatement":
        return this.statementCallsAsync(stmt.body) || this.exprCallsAsync(stmt.condition);
      case "ForStatement":
        return (
          (stmt.init !== null && this.exprCallsAsync(stmt.init)) ||
          (stmt.condition !== null && this.exprCallsAsync(stmt.condition)) ||
          (stmt.update !== null && this.exprCallsAsync(stmt.update)) ||
          this.statementCallsAsync(stmt.body)
        );
      case "ReturnStatement":
        return stmt.value !== null && this.exprCallsAsync(stmt.value);
      case "BlockStatement":
        return this.bodyCallsAsync(stmt.body);
      case "VariableDeclaration":
        return stmt.initializer !== null && this.exprCallsAsync(stmt.initializer);
      default:
        return false;
    }
  }

  private exprCallsAsync(expr: Expression): boolean {
    switch (expr.type) {
      case "FunctionCallExpression":
        return (
          FunctionResolver.ASYNC_FUNCTIONS.has(expr.name) ||
          this.asyncFunctions.has(expr.name) ||
          expr.arguments.some((a) => this.exprCallsAsync(a))
        );
      case "BinaryExpression":
        return this.exprCallsAsync(expr.left) || this.exprCallsAsync(expr.right);
      case "UnaryExpression":
        return this.exprCallsAsync(expr.operand);
      case "AssignmentExpression":
        return this.exprCallsAsync(expr.value);
      case "ParenthesizedExpression":
        return this.exprCallsAsync(expr.expression);
      default:
        return false;
    }
  }

  private bodyCallsUserAsync(body: Statement[]): boolean {
    for (const stmt of body) {
      if (this.statementCallsUserAsync(stmt)) return true;
    }
    return false;
  }

  private statementCallsUserAsync(stmt: Statement): boolean {
    switch (stmt.type) {
      case "EmptyStatement":
        return false;
      case "ExpressionStatement":
        return this.exprCallsUserAsync(stmt.expression);
      case "IfStatement":
        return (
          this.statementCallsUserAsync(stmt.consequent) ||
          (stmt.alternate !== null && this.statementCallsUserAsync(stmt.alternate))
        );
      case "WhileStatement":
      case "DoWhileStatement":
        return this.statementCallsUserAsync(stmt.body);
      case "ForStatement":
        return this.statementCallsUserAsync(stmt.body);
      case "BlockStatement":
        return this.bodyCallsUserAsync(stmt.body);
      case "ReturnStatement":
        return stmt.value !== null && this.exprCallsUserAsync(stmt.value);
      default:
        return false;
    }
  }

  private exprCallsUserAsync(expr: Expression): boolean {
    switch (expr.type) {
      case "FunctionCallExpression":
        return this.asyncFunctions.has(expr.name) ||
          expr.arguments.some((a) => this.exprCallsUserAsync(a));
      case "BinaryExpression":
        return this.exprCallsUserAsync(expr.left) || this.exprCallsUserAsync(expr.right);
      case "UnaryExpression":
        return this.exprCallsUserAsync(expr.operand);
      case "AssignmentExpression":
        return this.exprCallsUserAsync(expr.value);
      case "ParenthesizedExpression":
        return this.exprCallsUserAsync(expr.expression);
      default:
        return false;
    }
  }

  private scanForDetected(): void {
    for (const state of this.ast.states) {
      for (const event of state.events) {
        if (DETECTED_EVENTS.has(event.name)) {
          const key = `${state.name}:${event.name}`;
          this.needsDetected.set(key, this.bodyUsesDetected(event.body));
        }
      }
    }
  }

  private bodyUsesDetected(body: Statement[]): boolean {
    for (const stmt of body) {
      if (this.statementUsesDetected(stmt)) return true;
    }
    return false;
  }

  private statementUsesDetected(stmt: Statement): boolean {
    switch (stmt.type) {
      case "EmptyStatement":
        return false;
      case "ExpressionStatement":
        return this.exprUsesDetected(stmt.expression);
      case "IfStatement":
        return (
          this.exprUsesDetected(stmt.condition) ||
          this.statementUsesDetected(stmt.consequent) ||
          (stmt.alternate !== null && this.statementUsesDetected(stmt.alternate))
        );
      case "WhileStatement":
        return this.exprUsesDetected(stmt.condition) || this.statementUsesDetected(stmt.body);
      case "DoWhileStatement":
        return this.statementUsesDetected(stmt.body) || this.exprUsesDetected(stmt.condition);
      case "ForStatement":
        return (
          (stmt.init !== null && this.exprUsesDetected(stmt.init)) ||
          (stmt.condition !== null && this.exprUsesDetected(stmt.condition)) ||
          (stmt.update !== null && this.exprUsesDetected(stmt.update)) ||
          this.statementUsesDetected(stmt.body)
        );
      case "ReturnStatement":
        return stmt.value !== null && this.exprUsesDetected(stmt.value);
      case "BlockStatement":
        return this.bodyUsesDetected(stmt.body);
      case "VariableDeclaration":
        return stmt.initializer !== null && this.exprUsesDetected(stmt.initializer);
      default:
        return false;
    }
  }

  private exprUsesDetected(expr: Expression): boolean {
    switch (expr.type) {
      case "FunctionCallExpression":
        return (
          expr.name.startsWith("llDetected") ||
          expr.arguments.some((a) => this.exprUsesDetected(a))
        );
      case "BinaryExpression":
        return this.exprUsesDetected(expr.left) || this.exprUsesDetected(expr.right);
      case "UnaryExpression":
        return this.exprUsesDetected(expr.operand);
      case "PostfixExpression":
        return this.exprUsesDetected(expr.operand);
      case "AssignmentExpression":
        return this.exprUsesDetected(expr.target) || this.exprUsesDetected(expr.value);
      case "ParenthesizedExpression":
        return this.exprUsesDetected(expr.expression);
      default:
        return false;
    }
  }

  private scanForConstantsAndImports(): void {
    // Walk the entire AST looking for identifier references to known constants
    const walkExpr = (expr: Expression): void => {
      switch (expr.type) {
        case "IdentifierExpression":
          if (LSL_CONSTANTS[expr.name] !== undefined) {
            this.usedConstants.add(expr.name);
            const imports = CONSTANTS_REQUIRING_IMPORTS[expr.name];
            if (imports) imports.forEach((i) => this.usedImports.add(i));
          }
          break;
        case "BinaryExpression":
          walkExpr(expr.left);
          walkExpr(expr.right);
          break;
        case "UnaryExpression":
          walkExpr(expr.operand);
          break;
        case "PostfixExpression":
          walkExpr(expr.operand);
          break;
        case "AssignmentExpression":
          walkExpr(expr.target);
          walkExpr(expr.value);
          break;
        case "FunctionCallExpression":
          expr.arguments.forEach(walkExpr);
          // Check if function uses special helpers
          if (expr.name === "llGetSubString" || expr.name === "llDeleteSubString") {
            this.usedHelpers.add(expr.name === "llGetSubString" ? "lslSubString" : "lslDeleteSubString");
          }
          if (expr.name === "llInsertString") {
            this.usedHelpers.add("lslInsertString");
          }
          break;
        case "TypeCastExpression":
          walkExpr(expr.expression);
          if (expr.targetType === "vector") this.usedImports.add("Vector3");
          if (expr.targetType === "rotation") this.usedImports.add("Quaternion");
          break;
        case "VectorLiteral":
          walkExpr(expr.x);
          walkExpr(expr.y);
          walkExpr(expr.z);
          this.usedImports.add("Vector3");
          break;
        case "RotationLiteral":
          walkExpr(expr.x);
          walkExpr(expr.y);
          walkExpr(expr.z);
          walkExpr(expr.s);
          this.usedImports.add("Quaternion");
          break;
        case "ListLiteral":
          expr.elements.forEach(walkExpr);
          break;
        case "MemberExpression":
          walkExpr(expr.object);
          break;
        case "ParenthesizedExpression":
          walkExpr(expr.expression);
          break;
      }
    };

    const walkStmt = (stmt: Statement): void => {
      switch (stmt.type) {
        case "EmptyStatement":
          break;
        case "ExpressionStatement":
          walkExpr(stmt.expression);
          break;
        case "VariableDeclaration":
          if (stmt.initializer) walkExpr(stmt.initializer);
          if (stmt.dataType === "vector") this.usedImports.add("Vector3");
          if (stmt.dataType === "rotation") this.usedImports.add("Quaternion");
          break;
        case "IfStatement":
          walkExpr(stmt.condition);
          walkStmt(stmt.consequent);
          if (stmt.alternate) walkStmt(stmt.alternate);
          break;
        case "WhileStatement":
          walkExpr(stmt.condition);
          walkStmt(stmt.body);
          break;
        case "DoWhileStatement":
          walkStmt(stmt.body);
          walkExpr(stmt.condition);
          break;
        case "ForStatement":
          if (stmt.init) walkExpr(stmt.init);
          if (stmt.condition) walkExpr(stmt.condition);
          if (stmt.update) walkExpr(stmt.update);
          walkStmt(stmt.body);
          break;
        case "ReturnStatement":
          if (stmt.value) walkExpr(stmt.value);
          break;
        case "BlockStatement":
          stmt.body.forEach(walkStmt);
          break;
      }
    };

    // Walk globals
    for (const g of this.ast.globals) {
      if (g.type === "VariableDeclaration") {
        if (g.initializer) walkExpr(g.initializer);
        if (g.dataType === "vector") this.usedImports.add("Vector3");
        if (g.dataType === "rotation") this.usedImports.add("Quaternion");
      } else {
        g.body.forEach(walkStmt);
        for (const p of g.parameters) {
          if (p.dataType === "vector") this.usedImports.add("Vector3");
          if (p.dataType === "rotation") this.usedImports.add("Quaternion");
        }
      }
    }

    // Walk states
    for (const state of this.ast.states) {
      for (const event of state.events) {
        event.body.forEach(walkStmt);
      }
    }
  }

  // === Pass 2: Emit ===

  private emitImports(): string {
    const typeImports: string[] = ["WorldScript"];

    // Check if any touch events exist (need Agent type)
    const hasTouchEvents = this.ast.states.some((s) =>
      s.events.some((e) =>
        ["touch_start", "touch", "touch_end", "money", "control", "run_time_permissions"].includes(e.name)
      )
    );
    if (hasTouchEvents) typeImports.push("type Agent");

    // Check for detected events
    const hasDetectedEvents = this.ast.states.some((s) =>
      s.events.some((e) => DETECTED_EVENTS.has(e.name))
    );
    if (hasDetectedEvents) typeImports.push("type DetectedInfo");

    // Add Vector3/Quaternion if used
    if (this.usedImports.has("Vector3")) typeImports.push("Vector3");
    if (this.usedImports.has("Quaternion")) typeImports.push("Quaternion");

    // Add link constants
    for (const name of this.usedImports) {
      if (name.startsWith("LINK_")) typeImports.push(name);
    }

    // Deduplicate
    const unique = [...new Set(typeImports)];
    return `import { ${unique.join(", ")} } from "poqpoq/types";`;
  }

  private emitHelpers(): string {
    const helpers: string[] = [];

    if (this.usedHelpers.has("lslSubString")) {
      helpers.push(`/** LSL substring with inclusive end and negative index support */
function lslSubString(s: string, start: number, end: number): string {
  const len = s.length;
  if (start < 0) start = Math.max(0, len + start);
  if (end < 0) end = Math.max(0, len + end);
  if (start > end) return s.substring(0, end + 1) + s.substring(start);
  return s.substring(start, end + 1);
}`);
    }

    if (this.usedHelpers.has("lslDeleteSubString")) {
      helpers.push(`/** LSL deleteSubString with inclusive end */
function lslDeleteSubString(s: string, start: number, end: number): string {
  const len = s.length;
  if (start < 0) start = Math.max(0, len + start);
  if (end < 0) end = Math.max(0, len + end);
  if (start > end) return s.substring(end + 1, start);
  return s.substring(0, start) + s.substring(end + 1);
}`);
    }

    if (this.usedHelpers.has("lslInsertString")) {
      helpers.push(`/** LSL insertString */
function lslInsertString(s: string, pos: number, insert: string): string {
  return s.substring(0, pos) + insert + s.substring(pos);
}`);
    }

    return helpers.join("\n\n");
  }

  private emitClassBody(): string {
    const lines: string[] = [];

    lines.push(`export default class ${this.className} extends WorldScript {`);

    // Global variables → private fields
    const vars = this.ast.globals.filter(
      (g): g is VariableDeclaration => g.type === "VariableDeclaration"
    );
    for (const v of vars) {
      lines.push(`  private ${v.name}: ${lslTypeToTS(v.dataType)} = ${v.initializer ? this.emitExpression(v.initializer) : defaultValue(v.dataType)};`);
    }

    if (vars.length > 0) lines.push("");

    // Global functions → private methods
    const funcs = this.ast.globals.filter(
      (g): g is FunctionDeclaration => g.type === "FunctionDeclaration"
    );
    for (const f of funcs) {
      lines.push(this.emitFunction(f));
      lines.push("");
    }

    // States
    lines.push("  states = {");
    for (let i = 0; i < this.ast.states.length; i++) {
      const state = this.ast.states[i];
      lines.push(this.emitState(state));
      if (i < this.ast.states.length - 1) lines.push("");
    }
    lines.push("  };");

    lines.push("}");

    return lines.join("\n");
  }

  private emitFunction(decl: FunctionDeclaration): string {
    const isAsync = this.asyncFunctions.has(decl.name);
    const retType = decl.returnType ? lslTypeToTS(decl.returnType) : "void";
    const params = decl.parameters
      .map((p) => `${p.name}: ${lslTypeToTS(p.dataType)}`)
      .join(", ");

    const prefix = isAsync ? "  private async " : "  private ";
    const sig = `${prefix}${decl.name}(${params}): ${retType} {`;

    // Set up scope for the function body
    this.typeTracker.pushScope();
    this.typeTracker.registerParameters(decl.parameters);

    const body = this.emitBody(decl.body, 2);

    this.typeTracker.popScope();

    return `${sig}\n${body}\n  }`;
  }

  private emitState(state: StateDeclaration): string {
    const lines: string[] = [];
    const stateName = state.name;
    lines.push(`    ${stateName}: {`);

    for (let i = 0; i < state.events.length; i++) {
      lines.push(this.emitEvent(state.events[i], stateName));
      if (i < state.events.length - 1) lines.push("");
    }

    lines.push("    },");
    return lines.join("\n");
  }

  private emitEvent(handler: EventHandler, stateName: string): string {
    const tsName = EVENT_NAME_MAP[handler.name] ?? `on${handler.name.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())}`;

    // Build parameter list based on poqpoq event signatures
    const params = this.buildEventParams(handler, stateName);

    // Event handlers are always async (they may call async methods)
    const eventKey = `${stateName}:${handler.name}`;
    const hasDetected = this.needsDetected.get(eventKey) ?? false;

    const sig = `      async ${tsName}(${params}) {`;

    // Set up scope for the event body
    this.typeTracker.pushScope();

    // Register LSL parameter types
    for (const p of handler.parameters) {
      this.typeTracker.declare(p.name, p.dataType);
    }

    const body = this.emitBody(handler.body, 4);

    this.typeTracker.popScope();

    return `${sig}\n${body}\n      },`;
  }

  private buildEventParams(handler: EventHandler, stateName: string): string {
    const parts: string[] = [`this: ${this.className}`];
    const eventKey = `${stateName}:${handler.name}`;
    const hasDetected = this.needsDetected.get(eventKey) ?? false;

    switch (handler.name) {
      case "touch_start":
      case "touch":
      case "touch_end":
        parts.push("agent: Agent");
        parts.push("face: number");
        break;
      case "collision_start":
      case "collision":
      case "collision_end":
      case "sensor":
        parts.push("detected: DetectedInfo[]");
        break;
      case "listen":
        parts.push("channel: number");
        parts.push("name: string");
        parts.push("id: string");
        parts.push("message: string");
        break;
      case "timer":
        parts.push("timerId?: string");
        break;
      case "on_rez":
        parts.push("startParam: number");
        break;
      case "changed":
        parts.push("change: number");
        break;
      case "attach":
        parts.push("agentId: string");
        break;
      case "money":
        parts.push("agent: Agent");
        parts.push("amount: number");
        break;
      case "control":
        parts.push("agent: Agent");
        parts.push("held: number");
        parts.push("changed: number");
        break;
      case "run_time_permissions":
        parts.push("agent: Agent");
        parts.push("permissions: number");
        break;
      case "link_message":
        parts.push("senderLink: number");
        parts.push("num: number");
        parts.push("str: string");
        parts.push("id: string");
        break;
      case "dataserver":
        parts.push("queryId: string");
        parts.push("data: string");
        break;
      case "http_response":
        parts.push("requestId: string");
        parts.push("status: number");
        parts.push("headers: Record<string, string>");
        parts.push("body: string");
        break;
      // state_entry, state_exit, no_sensor, etc. — no extra params
    }

    return parts.join(", ");
  }

  // === Body / Statement emission ===

  private emitBody(body: Statement[], baseIndent: number): string {
    return body.map((s) => this.emitStatement(s, baseIndent)).join("\n");
  }

  private indent(level: number): string {
    return "  ".repeat(level);
  }

  private emitStatement(stmt: Statement, level: number): string {
    const ind = this.indent(level);

    switch (stmt.type) {
      case "VariableDeclaration":
        return this.emitLocalVar(stmt, level);

      case "ExpressionStatement":
        return `${ind}${this.emitExpression(stmt.expression)};`;

      case "EmptyStatement":
        return "";

      case "IfStatement":
        return this.emitIf(stmt, level);

      case "ForStatement":
        return this.emitFor(stmt, level);

      case "WhileStatement":
        return `${ind}while (${this.emitExpression(stmt.condition)}) {\n${this.emitStatementBody(stmt.body, level + 1)}\n${ind}}`;

      case "DoWhileStatement":
        return `${ind}do {\n${this.emitStatementBody(stmt.body, level + 1)}\n${ind}} while (${this.emitExpression(stmt.condition)});`;

      case "ReturnStatement":
        return stmt.value
          ? `${ind}return ${this.emitExpression(stmt.value)};`
          : `${ind}return;`;

      case "JumpStatement":
        this.diagnostics.push({
          severity: "warning",
          message: `jump ${stmt.label} — goto not directly supported, emitting break`,
          loc: stmt.loc,
        });
        return `${ind}break; /* jump ${stmt.label} */`;

      case "LabelStatement":
        this.diagnostics.push({
          severity: "warning",
          message: `@${stmt.label} — label not directly supported`,
          loc: stmt.loc,
        });
        return `${ind}/* @${stmt.label} */`;

      case "StateChangeStatement":
        return `${ind}await this.transitionTo("${stmt.targetState}");\n${ind}return;`;

      case "BlockStatement":
        return `${ind}{\n${this.emitBody(stmt.body, level + 1)}\n${ind}}`;

      default:
        return `${ind}/* unknown statement */`;
    }
  }

  private emitStatementBody(stmt: Statement, level: number): string {
    if (stmt.type === "BlockStatement") {
      return this.emitBody(stmt.body, level);
    }
    return this.emitStatement(stmt, level);
  }

  private emitLocalVar(decl: VariableDeclaration, level: number): string {
    const ind = this.indent(level);
    this.typeTracker.declare(decl.name, decl.dataType);
    const init = decl.initializer
      ? this.emitExpression(decl.initializer)
      : defaultValue(decl.dataType);
    return `${ind}let ${decl.name}: ${lslTypeToTS(decl.dataType)} = ${init};`;
  }

  private emitIf(stmt: import("./types.js").IfStatement, level: number): string {
    const ind = this.indent(level);
    let result = `${ind}if (${this.emitExpression(stmt.condition)}) {\n`;
    result += this.emitStatementBody(stmt.consequent, level + 1);
    result += `\n${ind}}`;

    if (stmt.alternate) {
      if (stmt.alternate.type === "IfStatement") {
        result += ` else ${this.emitIf(stmt.alternate, level).trimStart()}`;
      } else {
        result += ` else {\n`;
        result += this.emitStatementBody(stmt.alternate, level + 1);
        result += `\n${ind}}`;
      }
    }

    return result;
  }

  private emitFor(stmt: import("./types.js").ForStatement, level: number): string {
    const ind = this.indent(level);

    // Handle init that might be a variable declaration expression
    const initStr = stmt.init ? this.emitExpression(stmt.init) : "";
    const condStr = stmt.condition ? this.emitExpression(stmt.condition) : "";
    const updateStr = stmt.update ? this.emitExpression(stmt.update) : "";

    let result = `${ind}for (${initStr}; ${condStr}; ${updateStr}) {\n`;
    result += this.emitStatementBody(stmt.body, level + 1);
    result += `\n${ind}}`;

    return result;
  }

  // === Expression emission ===

  emitExpression(expr: Expression): string {
    switch (expr.type) {
      case "IntegerLiteral":
        return String(expr.value);

      case "FloatLiteral":
        return String(expr.value);

      case "StringLiteral":
        return JSON.stringify(expr.value);

      case "IdentifierExpression":
        return this.emitIdentifier(expr.name);

      case "VectorLiteral":
        return `new Vector3(${this.emitExpression(expr.x)}, ${this.emitExpression(expr.y)}, ${this.emitExpression(expr.z)})`;

      case "RotationLiteral":
        return `new Quaternion(${this.emitExpression(expr.x)}, ${this.emitExpression(expr.y)}, ${this.emitExpression(expr.z)}, ${this.emitExpression(expr.s)})`;

      case "ListLiteral":
        return `[${expr.elements.map((e) => this.emitExpression(e)).join(", ")}]`;

      case "BinaryExpression":
        return this.emitBinary(expr);

      case "UnaryExpression":
        return this.emitUnary(expr);

      case "PostfixExpression":
        return `${this.emitExpression(expr.operand)}${expr.operator}`;

      case "AssignmentExpression":
        return this.emitAssignment(expr);

      case "FunctionCallExpression":
        return this.emitFunctionCall(expr);

      case "TypeCastExpression":
        return this.emitTypeCast(expr);

      case "MemberExpression":
        return `${this.emitExpression(expr.object)}.${expr.property}`;

      case "ParenthesizedExpression":
        return `(${this.emitExpression(expr.expression)})`;

      default:
        return "/* unknown expr */";
    }
  }

  private emitIdentifier(name: string): string {
    // Check if it's a known LSL constant
    const constant = LSL_CONSTANTS[name];
    if (constant !== undefined) {
      return constant;
    }

    // Check if it's a global variable (needs this. prefix)
    const isGlobal = this.ast.globals.some(
      (g) => g.type === "VariableDeclaration" && g.name === name
    );
    if (isGlobal) {
      return `this.${name}`;
    }

    return name;
  }

  private emitBinary(expr: import("./types.js").BinaryExpression): string {
    // Check for operator overloading
    const overload = this.typeTracker.getOperatorMethod(expr.operator, expr.left, expr.right);

    if (overload) {
      const left = this.emitExpression(expr.left);
      const right = this.emitExpression(expr.right);

      if (overload.on === "left") {
        if (overload.invert) {
          // vector / scalar → vector.scale(1 / scalar)
          return `${left}.${overload.method}(1 / ${right})`;
        }
        return `${left}.${overload.method}(${right})`;
      } else {
        // scalar * vector → vector.scale(scalar)
        return `${right}.${overload.method}(${left})`;
      }
    }

    const left = this.emitExpression(expr.left);
    const right = this.emitExpression(expr.right);
    return `${left} ${expr.operator} ${right}`;
  }

  private emitUnary(expr: import("./types.js").UnaryExpression): string {
    const overload = this.typeTracker.getUnaryMethod(expr.operator, expr.operand);

    if (overload) {
      return `${this.emitExpression(expr.operand)}.${overload.method}()`;
    }

    return `${expr.operator}${this.emitExpression(expr.operand)}`;
  }

  private emitAssignment(expr: import("./types.js").AssignmentExpression): string {
    const target = this.emitExpression(expr.target);
    const value = this.emitExpression(expr.value);

    // Check for compound assignment with vector/rotation overloading
    if (expr.operator !== "=" && expr.operator.endsWith("=")) {
      const baseOp = expr.operator.slice(0, -1);
      const overload = this.typeTracker.getOperatorMethod(baseOp, expr.target, expr.value);
      if (overload) {
        if (overload.on === "left") {
          return `${target} = ${target}.${overload.method}(${value})`;
        }
      }
    }

    return `${target} ${expr.operator} ${value}`;
  }

  private emitFunctionCall(expr: import("./types.js").FunctionCallExpression): string {
    const args = expr.arguments.map((a) => this.emitExpression(a));

    // Built-in LSL function?
    if (this.resolver.isBuiltin(expr.name)) {
      const resolved = this.resolver.resolve(expr.name, args);
      if (resolved.warning) {
        this.diagnostics.push({
          severity: "warning",
          message: resolved.warning,
          loc: expr.loc,
          lslFunction: expr.name,
        });
      }
      return resolved.template;
    }

    // User-defined function → call as this.method()
    const isGlobalFunc = this.ast.globals.some(
      (g) => g.type === "FunctionDeclaration" && g.name === expr.name
    );
    if (isGlobalFunc) {
      const needsAwait = this.asyncFunctions.has(expr.name);
      const call = `this.${expr.name}(${args.join(", ")})`;
      return needsAwait ? `await ${call}` : call;
    }

    // Unknown function — emit as-is
    return `${expr.name}(${args.join(", ")})`;
  }

  private emitTypeCast(expr: import("./types.js").TypeCastExpression): string {
    const inner = this.emitExpression(expr.expression);

    switch (expr.targetType) {
      case "string":
        return `String(${inner})`;
      case "integer":
        return `Math.trunc(Number(${inner}))`;
      case "float":
        return `Number(${inner})`;
      case "key":
        return `String(${inner})`;
      case "vector":
        return `Vector3.fromString(${inner})`;
      case "rotation":
        return `Quaternion.fromString(${inner})`;
      case "list":
        return `[${inner}]`;
      default:
        return inner;
    }
  }

  // === Helpers ===

  private deriveClassName(): string {
    if (this.options.filename) {
      // "DefaultScript.lsl" → "DefaultScript"
      return this.options.filename
        .replace(/\.lsl$/i, "")
        .replace(/[^a-zA-Z0-9_]/g, "")
        .replace(/^(\d)/, "_$1") || "LSLScript";
    }
    return "LSLScript";
  }
}

/** Convenience function: generate TypeScript from an LSL AST */
export function generate(ast: LSLScript, options?: TranspileOptions): TranspileResult {
  return new CodeGenerator(ast, options).generate();
}
