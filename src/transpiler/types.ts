/**
 * LSL Transpiler AST Types
 *
 * Defines the token types, AST node interfaces, and transpiler options
 * for the LSL-to-TypeScript transpiler.
 */

import type { SourceLocation, Diagnostic } from "./errors.js";

// ============================================================
// Token Types
// ============================================================

export enum TokenType {
  // Literals
  IntegerLiteral = "IntegerLiteral",
  FloatLiteral = "FloatLiteral",
  StringLiteral = "StringLiteral",

  // Identifier
  Identifier = "Identifier",

  // Type keywords
  KW_Integer = "KW_Integer",
  KW_Float = "KW_Float",
  KW_String = "KW_String",
  KW_Key = "KW_Key",
  KW_Vector = "KW_Vector",
  KW_Rotation = "KW_Rotation",
  KW_List = "KW_List",

  // Control keywords
  KW_If = "KW_If",
  KW_Else = "KW_Else",
  KW_For = "KW_For",
  KW_While = "KW_While",
  KW_Do = "KW_Do",
  KW_Jump = "KW_Jump",
  KW_Return = "KW_Return",
  KW_State = "KW_State",
  KW_Default = "KW_Default",

  // Punctuation
  LeftParen = "LeftParen",
  RightParen = "RightParen",
  LeftBrace = "LeftBrace",
  RightBrace = "RightBrace",
  LeftBracket = "LeftBracket",
  RightBracket = "RightBracket",
  Semicolon = "Semicolon",
  Comma = "Comma",
  At = "At",
  Dot = "Dot",

  // Comparison / angle brackets
  LeftAngle = "LeftAngle",
  RightAngle = "RightAngle",
  LessEqual = "LessEqual",
  GreaterEqual = "GreaterEqual",
  Equal = "Equal",
  NotEqual = "NotEqual",

  // Arithmetic
  Plus = "Plus",
  Minus = "Minus",
  Star = "Star",
  Slash = "Slash",
  Percent = "Percent",

  // Assignment
  Assign = "Assign",
  PlusAssign = "PlusAssign",
  MinusAssign = "MinusAssign",
  StarAssign = "StarAssign",
  SlashAssign = "SlashAssign",
  PercentAssign = "PercentAssign",

  // Logical
  And = "And",
  Or = "Or",
  Not = "Not",

  // Bitwise
  BitwiseAnd = "BitwiseAnd",
  BitwiseOr = "BitwiseOr",
  BitwiseXor = "BitwiseXor",
  BitwiseNot = "BitwiseNot",
  ShiftLeft = "ShiftLeft",
  ShiftRight = "ShiftRight",
  BitwiseAndAssign = "BitwiseAndAssign",
  BitwiseOrAssign = "BitwiseOrAssign",
  BitwiseXorAssign = "BitwiseXorAssign",
  ShiftLeftAssign = "ShiftLeftAssign",
  ShiftRightAssign = "ShiftRightAssign",

  // Increment/Decrement
  Increment = "Increment",
  Decrement = "Decrement",

  // Special
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
  loc: SourceLocation;
}

// ============================================================
// LSL Types
// ============================================================

export type LSLType =
  | "integer"
  | "float"
  | "string"
  | "key"
  | "vector"
  | "rotation"
  | "list"
  | "void"
  | "unknown";

/** Check if a string is a valid LSL type keyword */
export function isLSLType(value: string): value is LSLType {
  return [
    "integer",
    "float",
    "string",
    "key",
    "vector",
    "rotation",
    "list",
  ].includes(value);
}

// ============================================================
// AST Node Types
// ============================================================

/** Base for all AST nodes */
interface BaseNode {
  loc: SourceLocation;
}

// --- Top-level ---

export interface LSLScript extends BaseNode {
  type: "Script";
  globals: (VariableDeclaration | FunctionDeclaration)[];
  states: StateDeclaration[];
}

export interface StateDeclaration extends BaseNode {
  type: "StateDeclaration";
  name: string; // "default" or user-defined
  events: EventHandler[];
}

export interface EventHandler extends BaseNode {
  type: "EventHandler";
  name: string; // "state_entry", "touch_start", "timer", etc.
  parameters: Parameter[];
  body: Statement[];
}

export interface FunctionDeclaration extends BaseNode {
  type: "FunctionDeclaration";
  returnType: LSLType | null; // null = void
  name: string;
  parameters: Parameter[];
  body: Statement[];
}

export interface Parameter extends BaseNode {
  type: "Parameter";
  dataType: LSLType;
  name: string;
}

export interface VariableDeclaration extends BaseNode {
  type: "VariableDeclaration";
  dataType: LSLType;
  name: string;
  initializer: Expression | null;
}

// --- Statements ---

export type Statement =
  | VariableDeclaration
  | ExpressionStatement
  | EmptyStatement
  | IfStatement
  | ForStatement
  | WhileStatement
  | DoWhileStatement
  | ReturnStatement
  | JumpStatement
  | LabelStatement
  | StateChangeStatement
  | BlockStatement;

export interface ExpressionStatement extends BaseNode {
  type: "ExpressionStatement";
  expression: Expression;
}

export interface EmptyStatement extends BaseNode {
  type: "EmptyStatement";
}

export interface IfStatement extends BaseNode {
  type: "IfStatement";
  condition: Expression;
  consequent: Statement;
  alternate: Statement | null;
}

export interface ForStatement extends BaseNode {
  type: "ForStatement";
  init: Expression | null;
  condition: Expression | null;
  update: Expression | null;
  body: Statement;
}

export interface WhileStatement extends BaseNode {
  type: "WhileStatement";
  condition: Expression;
  body: Statement;
}

export interface DoWhileStatement extends BaseNode {
  type: "DoWhileStatement";
  body: Statement;
  condition: Expression;
}

export interface ReturnStatement extends BaseNode {
  type: "ReturnStatement";
  value: Expression | null;
}

export interface JumpStatement extends BaseNode {
  type: "JumpStatement";
  label: string;
}

export interface LabelStatement extends BaseNode {
  type: "LabelStatement";
  label: string;
}

export interface StateChangeStatement extends BaseNode {
  type: "StateChangeStatement";
  targetState: string;
}

export interface BlockStatement extends BaseNode {
  type: "BlockStatement";
  body: Statement[];
}

// --- Expressions ---

export type Expression =
  | IntegerLiteral
  | FloatLiteral
  | StringLiteral
  | IdentifierExpression
  | VectorLiteral
  | RotationLiteral
  | ListLiteral
  | BinaryExpression
  | UnaryExpression
  | PostfixExpression
  | AssignmentExpression
  | FunctionCallExpression
  | TypeCastExpression
  | MemberExpression
  | ParenthesizedExpression;

export interface IntegerLiteral extends BaseNode {
  type: "IntegerLiteral";
  value: number;
}

export interface FloatLiteral extends BaseNode {
  type: "FloatLiteral";
  value: number;
}

export interface StringLiteral extends BaseNode {
  type: "StringLiteral";
  value: string;
}

export interface IdentifierExpression extends BaseNode {
  type: "IdentifierExpression";
  name: string;
}

export interface VectorLiteral extends BaseNode {
  type: "VectorLiteral";
  x: Expression;
  y: Expression;
  z: Expression;
}

export interface RotationLiteral extends BaseNode {
  type: "RotationLiteral";
  x: Expression;
  y: Expression;
  z: Expression;
  s: Expression;
}

export interface ListLiteral extends BaseNode {
  type: "ListLiteral";
  elements: Expression[];
}

export interface BinaryExpression extends BaseNode {
  type: "BinaryExpression";
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression extends BaseNode {
  type: "UnaryExpression";
  operator: string;
  operand: Expression;
}

export interface PostfixExpression extends BaseNode {
  type: "PostfixExpression";
  operator: string;
  operand: Expression;
}

export interface AssignmentExpression extends BaseNode {
  type: "AssignmentExpression";
  operator: string; // "=", "+=", "-=", etc.
  target: Expression; // IdentifierExpression or MemberExpression
  value: Expression;
}

export interface FunctionCallExpression extends BaseNode {
  type: "FunctionCallExpression";
  name: string;
  arguments: Expression[];
}

export interface TypeCastExpression extends BaseNode {
  type: "TypeCastExpression";
  targetType: LSLType;
  expression: Expression;
}

export interface MemberExpression extends BaseNode {
  type: "MemberExpression";
  object: Expression;
  property: string; // "x", "y", "z", "s"
}

export interface ParenthesizedExpression extends BaseNode {
  type: "ParenthesizedExpression";
  expression: Expression;
}

// ============================================================
// Transpiler Options & Result
// ============================================================

export interface TranspileOptions {
  /** Class name for the generated TypeScript class */
  className?: string;
  /** Include AST in the result */
  includeAst?: boolean;
  /** Source filename (for error messages and class name derivation) */
  filename?: string;
  /** Emit /* LSL: ... *​/ comments showing original LSL */
  emitSourceComments?: boolean;
}

export interface TranspileResult {
  /** Generated TypeScript code */
  code: string;
  /** Whether transpilation succeeded */
  success: boolean;
  /** Diagnostics (errors, warnings, info) */
  diagnostics: Diagnostic[];
  /** The AST (if requested via includeAst option) */
  ast?: LSLScript;
  /** The class name used in the output */
  className: string;
}
