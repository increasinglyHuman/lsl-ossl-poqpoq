/**
 * LSL Parser — Recursive descent parser producing an LSL AST.
 *
 * Handles the full LSL grammar:
 * - Global variables and functions
 * - State declarations with event handlers
 * - All expression types including vector/rotation literals
 * - Type casts, member access, function calls
 * - Control flow: if/else, for, while, do-while, jump/label, return, state change
 */

import {
  TokenType,
  type Token,
  type LSLType,
  type LSLScript,
  type StateDeclaration,
  type EventHandler,
  type FunctionDeclaration,
  type VariableDeclaration,
  type Parameter,
  type Statement,
  type Expression,
  type BlockStatement,
  isLSLType,
} from "./types.js";
import { tokenize } from "./lexer.js";
import { ParserError, type SourceLocation } from "./errors.js";
import { LSL_EVENTS } from "./event-map.js";

export class Parser {
  private tokens: Token[] = [];
  private pos = 0;

  constructor(private source: string) {}

  /** Parse the source into an LSL AST */
  parse(): LSLScript {
    this.tokens = tokenize(this.source);
    this.pos = 0;

    const globals: (VariableDeclaration | FunctionDeclaration)[] = [];
    const states: StateDeclaration[] = [];

    const loc = this.current().loc;

    // Parse globals (variables and functions) until we hit a state
    while (!this.isAtEnd()) {
      if (this.isStateStart()) {
        break;
      }
      const decl = this.parseGlobalDeclaration();
      globals.push(decl);
    }

    // Parse states
    while (!this.isAtEnd()) {
      states.push(this.parseState());
    }

    return { type: "Script", globals, states, loc };
  }

  // ============================================================
  // Utilities
  // ============================================================

  private current(): Token {
    return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1];
  }

  private peek(offset = 0): Token {
    return this.tokens[this.pos + offset] ?? this.tokens[this.tokens.length - 1];
  }

  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }

  private advance(): Token {
    const token = this.current();
    if (!this.isAtEnd()) this.pos++;
    return token;
  }

  private expect(type: TokenType, message?: string): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new ParserError(
        message ?? `Expected ${type}, got ${token.type} ('${token.value}')`,
        token.loc,
        this.source,
      );
    }
    return this.advance();
  }

  private match(type: TokenType): boolean {
    if (this.current().type === type) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private error(message: string): ParserError {
    return new ParserError(message, this.current().loc, this.source);
  }

  // ============================================================
  // State Detection
  // ============================================================

  /** Check if current position starts a state declaration */
  private isStateStart(): boolean {
    if (this.check(TokenType.KW_Default)) return true;
    if (this.check(TokenType.KW_State) && this.peek(1).type === TokenType.Identifier) {
      // Distinguish `state foo {` (state decl) from `state foo;` (state change)
      // Look ahead past `state IDENT` to see if `{` follows
      const afterIdent = this.peek(2);
      return afterIdent.type === TokenType.LeftBrace;
    }
    return false;
  }

  /** Check if we're looking at a type keyword */
  private isTypeKeyword(): boolean {
    const t = this.current().type;
    return (
      t === TokenType.KW_Integer ||
      t === TokenType.KW_Float ||
      t === TokenType.KW_String ||
      t === TokenType.KW_Key ||
      t === TokenType.KW_Vector ||
      t === TokenType.KW_Rotation ||
      t === TokenType.KW_List
    );
  }

  /** Parse a type keyword into LSLType */
  private parseType(): LSLType {
    const token = this.advance();
    switch (token.type) {
      case TokenType.KW_Integer: return "integer";
      case TokenType.KW_Float: return "float";
      case TokenType.KW_String: return "string";
      case TokenType.KW_Key: return "key";
      case TokenType.KW_Vector: return "vector";
      case TokenType.KW_Rotation: return "rotation";
      case TokenType.KW_List: return "list";
      default:
        throw new ParserError(`Expected type keyword, got '${token.value}'`, token.loc, this.source);
    }
  }

  // ============================================================
  // Top-Level Declarations
  // ============================================================

  /** Parse a global declaration: variable or function */
  private parseGlobalDeclaration(): VariableDeclaration | FunctionDeclaration {
    const loc = this.current().loc;

    // Check for function with no return type: name(...)
    if (this.check(TokenType.Identifier) && this.peek(1).type === TokenType.LeftParen) {
      return this.parseFunction(null, loc);
    }

    // Must start with a type keyword
    if (!this.isTypeKeyword()) {
      throw this.error(`Expected type keyword or state declaration, got '${this.current().value}'`);
    }

    const dataType = this.parseType();
    const name = this.expect(TokenType.Identifier, "Expected identifier after type").value;

    // Function: type name(...)
    if (this.check(TokenType.LeftParen)) {
      return this.parseFunction(dataType, loc, name);
    }

    // Variable: type name [= expr] ;
    let initializer: Expression | null = null;
    if (this.match(TokenType.Assign)) {
      initializer = this.parseExpression();
    }
    this.expect(TokenType.Semicolon, "Expected ';' after variable declaration");

    return { type: "VariableDeclaration", dataType, name, initializer, loc };
  }

  /** Parse a function declaration (name already consumed if provided) */
  private parseFunction(
    returnType: LSLType | null,
    loc: SourceLocation,
    name?: string,
  ): FunctionDeclaration {
    if (!name) {
      name = this.expect(TokenType.Identifier, "Expected function name").value;
    }

    this.expect(TokenType.LeftParen, "Expected '(' after function name");
    const parameters = this.parseParameterList();
    this.expect(TokenType.RightParen, "Expected ')' after parameters");

    const body = this.parseBlock();

    return {
      type: "FunctionDeclaration",
      returnType,
      name,
      parameters,
      body: body.body,
      loc,
    };
  }

  /** Parse a comma-separated parameter list */
  private parseParameterList(): Parameter[] {
    const params: Parameter[] = [];

    if (!this.isTypeKeyword()) return params;

    do {
      const paramLoc = this.current().loc;
      const dataType = this.parseType();
      const name = this.expect(TokenType.Identifier, "Expected parameter name").value;
      params.push({ type: "Parameter", dataType, name, loc: paramLoc });
    } while (this.match(TokenType.Comma));

    return params;
  }

  // ============================================================
  // State Declarations
  // ============================================================

  private parseState(): StateDeclaration {
    const loc = this.current().loc;
    let name: string;

    if (this.match(TokenType.KW_Default)) {
      name = "default";
    } else {
      this.expect(TokenType.KW_State, "Expected 'state' or 'default'");
      name = this.expect(TokenType.Identifier, "Expected state name").value;
    }

    this.expect(TokenType.LeftBrace, "Expected '{' after state name");

    const events: EventHandler[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      events.push(this.parseEventHandler());
    }

    this.expect(TokenType.RightBrace, "Expected '}' to close state");

    return { type: "StateDeclaration", name, events, loc };
  }

  private parseEventHandler(): EventHandler {
    const loc = this.current().loc;
    const name = this.expect(TokenType.Identifier, "Expected event name").value;

    if (!LSL_EVENTS.has(name)) {
      // Not a fatal error — might be an unknown OSSL event
    }

    this.expect(TokenType.LeftParen, `Expected '(' after event name '${name}'`);
    const parameters = this.parseParameterList();
    this.expect(TokenType.RightParen, `Expected ')' after event parameters`);

    const body = this.parseBlock();

    return {
      type: "EventHandler",
      name,
      parameters,
      body: body.body,
      loc,
    };
  }

  // ============================================================
  // Statements
  // ============================================================

  private parseBlock(): BlockStatement {
    const loc = this.current().loc;
    this.expect(TokenType.LeftBrace, "Expected '{'");

    const body: Statement[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      body.push(this.parseStatement());
    }

    this.expect(TokenType.RightBrace, "Expected '}'");
    return { type: "BlockStatement", body, loc };
  }

  private parseStatement(): Statement {
    // Empty statement (bare semicolons — valid in LSL, common in OAR exports)
    if (this.check(TokenType.Semicolon)) {
      const loc = this.current().loc;
      this.advance();
      return { type: "EmptyStatement", loc };
    }

    // Block
    if (this.check(TokenType.LeftBrace)) {
      return this.parseBlock();
    }

    // Variable declaration: type name ...
    if (this.isTypeKeyword() && this.peek(1).type === TokenType.Identifier) {
      return this.parseLocalVarDecl();
    }

    // If
    if (this.check(TokenType.KW_If)) {
      return this.parseIf();
    }

    // For
    if (this.check(TokenType.KW_For)) {
      return this.parseFor();
    }

    // While
    if (this.check(TokenType.KW_While)) {
      return this.parseWhile();
    }

    // Do-while
    if (this.check(TokenType.KW_Do)) {
      return this.parseDoWhile();
    }

    // Return
    if (this.check(TokenType.KW_Return)) {
      return this.parseReturn();
    }

    // Jump
    if (this.check(TokenType.KW_Jump)) {
      return this.parseJump();
    }

    // Label: @name;
    if (this.check(TokenType.At)) {
      return this.parseLabel();
    }

    // State change: state name; or state default;
    if (this.check(TokenType.KW_State)) {
      return this.parseStateChange();
    }

    // Expression statement
    return this.parseExpressionStatement();
  }

  private parseLocalVarDecl(): VariableDeclaration {
    const loc = this.current().loc;
    const dataType = this.parseType();
    const name = this.expect(TokenType.Identifier, "Expected variable name").value;

    let initializer: Expression | null = null;
    if (this.match(TokenType.Assign)) {
      initializer = this.parseExpression();
    }

    this.expect(TokenType.Semicolon, "Expected ';' after variable declaration");

    return { type: "VariableDeclaration", dataType, name, initializer, loc };
  }

  private parseIf(): Statement {
    const loc = this.current().loc;
    this.advance(); // if
    this.expect(TokenType.LeftParen);
    const condition = this.parseExpression();
    this.expect(TokenType.RightParen);
    const consequent = this.parseStatement();

    let alternate: Statement | null = null;
    if (this.match(TokenType.KW_Else)) {
      alternate = this.parseStatement();
    }

    return { type: "IfStatement", condition, consequent, alternate, loc };
  }

  private parseFor(): Statement {
    const loc = this.current().loc;
    this.advance(); // for
    this.expect(TokenType.LeftParen);

    let init: Expression | null = null;
    if (!this.check(TokenType.Semicolon)) {
      init = this.parseExpression();
    }
    this.expect(TokenType.Semicolon);

    let condition: Expression | null = null;
    if (!this.check(TokenType.Semicolon)) {
      condition = this.parseExpression();
    }
    this.expect(TokenType.Semicolon);

    let update: Expression | null = null;
    if (!this.check(TokenType.RightParen)) {
      update = this.parseExpression();
    }
    this.expect(TokenType.RightParen);

    const body = this.parseStatement();

    return { type: "ForStatement", init, condition, update, body, loc };
  }

  private parseWhile(): Statement {
    const loc = this.current().loc;
    this.advance(); // while
    this.expect(TokenType.LeftParen);
    const condition = this.parseExpression();
    this.expect(TokenType.RightParen);
    const body = this.parseStatement();

    return { type: "WhileStatement", condition, body, loc };
  }

  private parseDoWhile(): Statement {
    const loc = this.current().loc;
    this.advance(); // do
    const body = this.parseStatement();
    this.expect(TokenType.KW_While, "Expected 'while' after do block");
    this.expect(TokenType.LeftParen);
    const condition = this.parseExpression();
    this.expect(TokenType.RightParen);
    this.expect(TokenType.Semicolon);

    return { type: "DoWhileStatement", body, condition, loc };
  }

  private parseReturn(): Statement {
    const loc = this.current().loc;
    this.advance(); // return

    let value: Expression | null = null;
    if (!this.check(TokenType.Semicolon)) {
      value = this.parseExpression();
    }
    this.expect(TokenType.Semicolon, "Expected ';' after return");

    return { type: "ReturnStatement", value, loc };
  }

  private parseJump(): Statement {
    const loc = this.current().loc;
    this.advance(); // jump
    const label = this.expect(TokenType.Identifier, "Expected label name after 'jump'").value;
    this.expect(TokenType.Semicolon);
    return { type: "JumpStatement", label, loc };
  }

  private parseLabel(): Statement {
    const loc = this.current().loc;
    this.advance(); // @
    const label = this.expect(TokenType.Identifier, "Expected label name after '@'").value;
    this.expect(TokenType.Semicolon);
    return { type: "LabelStatement", label, loc };
  }

  private parseStateChange(): Statement {
    const loc = this.current().loc;
    this.advance(); // state

    let targetState: string;
    if (this.check(TokenType.KW_Default)) {
      this.advance();
      targetState = "default";
    } else {
      targetState = this.expect(TokenType.Identifier, "Expected state name").value;
    }

    this.expect(TokenType.Semicolon, "Expected ';' after state change");
    return { type: "StateChangeStatement", targetState, loc };
  }

  private parseExpressionStatement(): Statement {
    const loc = this.current().loc;
    const expression = this.parseExpression();
    this.expect(TokenType.Semicolon, "Expected ';' after expression");
    return { type: "ExpressionStatement", expression, loc };
  }

  // ============================================================
  // Expressions — Precedence Climbing
  // ============================================================

  private parseExpression(): Expression {
    return this.parseAssignment();
  }

  private parseAssignment(): Expression {
    const expr = this.parseLogicalOr();

    // Check for assignment operators
    const assignOps = [
      TokenType.Assign,
      TokenType.PlusAssign,
      TokenType.MinusAssign,
      TokenType.StarAssign,
      TokenType.SlashAssign,
      TokenType.PercentAssign,
      TokenType.BitwiseAndAssign,
      TokenType.BitwiseOrAssign,
      TokenType.BitwiseXorAssign,
      TokenType.ShiftLeftAssign,
      TokenType.ShiftRightAssign,
    ];

    if (assignOps.includes(this.current().type)) {
      const op = this.advance();
      const value = this.parseAssignment(); // right-associative
      return {
        type: "AssignmentExpression",
        operator: op.value,
        target: expr,
        value,
        loc: expr.loc,
      };
    }

    return expr;
  }

  // LSL: && and || have the same precedence (unusual!)
  private parseLogicalOr(): Expression {
    let left = this.parseBitwiseOr();

    while (this.check(TokenType.Or) || this.check(TokenType.And)) {
      const op = this.advance();
      const right = this.parseBitwiseOr();
      left = { type: "BinaryExpression", operator: op.value, left, right, loc: left.loc };
    }

    return left;
  }

  private parseBitwiseOr(): Expression {
    let left = this.parseBitwiseXor();

    while (this.check(TokenType.BitwiseOr)) {
      const op = this.advance();
      const right = this.parseBitwiseXor();
      left = { type: "BinaryExpression", operator: op.value, left, right, loc: left.loc };
    }

    return left;
  }

  private parseBitwiseXor(): Expression {
    let left = this.parseBitwiseAnd();

    while (this.check(TokenType.BitwiseXor)) {
      const op = this.advance();
      const right = this.parseBitwiseAnd();
      left = { type: "BinaryExpression", operator: op.value, left, right, loc: left.loc };
    }

    return left;
  }

  private parseBitwiseAnd(): Expression {
    let left = this.parseEquality();

    while (this.check(TokenType.BitwiseAnd)) {
      const op = this.advance();
      const right = this.parseEquality();
      left = { type: "BinaryExpression", operator: op.value, left, right, loc: left.loc };
    }

    return left;
  }

  private parseEquality(): Expression {
    let left = this.parseComparison();

    while (this.check(TokenType.Equal) || this.check(TokenType.NotEqual)) {
      const op = this.advance();
      const right = this.parseComparison();
      left = { type: "BinaryExpression", operator: op.value, left, right, loc: left.loc };
    }

    return left;
  }

  private parseComparison(): Expression {
    let left = this.parseShift();

    while (
      this.check(TokenType.LeftAngle) ||
      this.check(TokenType.RightAngle) ||
      this.check(TokenType.LessEqual) ||
      this.check(TokenType.GreaterEqual)
    ) {
      // LeftAngle could be a vector literal — but at this point in the
      // precedence chain, we've already tried vector literals in primary.
      // If we're here, LeftAngle is a comparison operator.
      const op = this.advance();
      const right = this.parseShift();
      left = { type: "BinaryExpression", operator: op.value, left, right, loc: left.loc };
    }

    return left;
  }

  private parseShift(): Expression {
    let left = this.parseAdditive();

    while (this.check(TokenType.ShiftLeft) || this.check(TokenType.ShiftRight)) {
      const op = this.advance();
      const right = this.parseAdditive();
      left = { type: "BinaryExpression", operator: op.value, left, right, loc: left.loc };
    }

    return left;
  }

  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();

    while (this.check(TokenType.Plus) || this.check(TokenType.Minus)) {
      const op = this.advance();
      const right = this.parseMultiplicative();
      left = { type: "BinaryExpression", operator: op.value, left, right, loc: left.loc };
    }

    return left;
  }

  private parseMultiplicative(): Expression {
    let left = this.parseUnary();

    while (
      this.check(TokenType.Star) ||
      this.check(TokenType.Slash) ||
      this.check(TokenType.Percent)
    ) {
      const op = this.advance();
      const right = this.parseUnary();
      left = { type: "BinaryExpression", operator: op.value, left, right, loc: left.loc };
    }

    return left;
  }

  private parseUnary(): Expression {
    // Prefix: !, -, ~, ++, --
    if (
      this.check(TokenType.Not) ||
      this.check(TokenType.Minus) ||
      this.check(TokenType.BitwiseNot) ||
      this.check(TokenType.Increment) ||
      this.check(TokenType.Decrement)
    ) {
      const op = this.advance();
      const operand = this.parseUnary();
      return { type: "UnaryExpression", operator: op.value, operand, loc: op.loc };
    }

    // Type cast: (type)expr
    if (this.check(TokenType.LeftParen)) {
      const nextToken = this.peek(1);
      // Check if the token after ( is a type keyword and ) follows
      if (this.isTypeToken(nextToken.type) && this.peek(2).type === TokenType.RightParen) {
        const loc = this.current().loc;
        this.advance(); // (
        const targetType = this.parseType();
        this.advance(); // )
        const expression = this.parseUnary();
        return { type: "TypeCastExpression", targetType, expression, loc };
      }
    }

    return this.parsePostfix();
  }

  private isTypeToken(type: TokenType): boolean {
    return (
      type === TokenType.KW_Integer ||
      type === TokenType.KW_Float ||
      type === TokenType.KW_String ||
      type === TokenType.KW_Key ||
      type === TokenType.KW_Vector ||
      type === TokenType.KW_Rotation ||
      type === TokenType.KW_List
    );
  }

  private parsePostfix(): Expression {
    let expr = this.parsePrimary();

    // Postfix ++, --
    if (this.check(TokenType.Increment) || this.check(TokenType.Decrement)) {
      const op = this.advance();
      expr = { type: "PostfixExpression", operator: op.value, operand: expr, loc: expr.loc };
    }

    // Member access: .x, .y, .z, .s
    while (this.check(TokenType.Dot)) {
      this.advance(); // .
      const property = this.expect(TokenType.Identifier, "Expected property name after '.'").value;
      expr = { type: "MemberExpression", object: expr, property, loc: expr.loc };
    }

    return expr;
  }

  private parsePrimary(): Expression {
    const token = this.current();

    // Integer literal
    if (token.type === TokenType.IntegerLiteral) {
      this.advance();
      return { type: "IntegerLiteral", value: parseInt(token.value, 10), loc: token.loc };
    }

    // Float literal
    if (token.type === TokenType.FloatLiteral) {
      this.advance();
      return { type: "FloatLiteral", value: parseFloat(token.value), loc: token.loc };
    }

    // String literal
    if (token.type === TokenType.StringLiteral) {
      this.advance();
      return { type: "StringLiteral", value: token.value, loc: token.loc };
    }

    // List literal: [...]
    if (token.type === TokenType.LeftBracket) {
      return this.parseListLiteral();
    }

    // Vector or rotation literal: <...>
    if (token.type === TokenType.LeftAngle) {
      const vectorOrRotation = this.tryParseVectorOrRotation();
      if (vectorOrRotation) return vectorOrRotation;
      // If parsing fails, LeftAngle will be handled as comparison in the caller
      // But we shouldn't reach here — LeftAngle in primary means it must be a vector/rotation
      throw this.error("Expected vector or rotation literal after '<'");
    }

    // Parenthesized expression: (expr)
    if (token.type === TokenType.LeftParen) {
      this.advance(); // (
      const expr = this.parseExpression();
      this.expect(TokenType.RightParen, "Expected ')'");
      return { type: "ParenthesizedExpression", expression: expr, loc: token.loc };
    }

    // Identifier or function call
    if (token.type === TokenType.Identifier) {
      this.advance();

      // Function call: name(args)
      if (this.check(TokenType.LeftParen)) {
        this.advance(); // (
        const args: Expression[] = [];

        if (!this.check(TokenType.RightParen)) {
          args.push(this.parseExpression());
          while (this.match(TokenType.Comma)) {
            args.push(this.parseExpression());
          }
        }

        this.expect(TokenType.RightParen, "Expected ')' after function arguments");
        return { type: "FunctionCallExpression", name: token.value, arguments: args, loc: token.loc };
      }

      return { type: "IdentifierExpression", name: token.value, loc: token.loc };
    }

    throw this.error(`Unexpected token: '${token.value}' (${token.type})`);
  }

  // ============================================================
  // Vector/Rotation Literal Parsing
  // ============================================================

  /**
   * Try to parse a vector or rotation literal.
   * Uses speculative parsing: saves position, tries to parse,
   * backtracks if it fails.
   */
  private tryParseVectorOrRotation(): Expression | null {
    const savedPos = this.pos;
    const loc = this.current().loc;

    try {
      this.advance(); // <

      // Parse at shift level (below comparison) so we don't consume > as comparison
      const first = this.parseShift();
      if (!this.match(TokenType.Comma)) {
        this.pos = savedPos;
        return null;
      }

      const second = this.parseShift();
      if (!this.match(TokenType.Comma)) {
        this.pos = savedPos;
        return null;
      }

      const third = this.parseShift();

      // Check for rotation (4 components)
      if (this.match(TokenType.Comma)) {
        const fourth = this.parseShift();
        if (!this.match(TokenType.RightAngle)) {
          this.pos = savedPos;
          return null;
        }
        return { type: "RotationLiteral", x: first, y: second, z: third, s: fourth, loc };
      }

      // Vector (3 components)
      if (!this.match(TokenType.RightAngle)) {
        this.pos = savedPos;
        return null;
      }

      return { type: "VectorLiteral", x: first, y: second, z: third, loc };
    } catch {
      this.pos = savedPos;
      return null;
    }
  }

  private parseListLiteral(): Expression {
    const loc = this.current().loc;
    this.advance(); // [

    const elements: Expression[] = [];

    if (!this.check(TokenType.RightBracket)) {
      elements.push(this.parseExpression());
      while (this.match(TokenType.Comma)) {
        elements.push(this.parseExpression());
      }
    }

    this.expect(TokenType.RightBracket, "Expected ']' to close list literal");
    return { type: "ListLiteral", elements, loc };
  }
}

/** Convenience function: parse LSL source to AST */
export function parse(source: string): LSLScript {
  return new Parser(source).parse();
}
