/**
 * LSL Lexer — Tokenizes LSL source code into a token stream.
 *
 * Handles all LSL token types: keywords, identifiers, numbers (int/float/hex),
 * strings (with escape sequences), operators, and punctuation.
 * Strips comments while preserving accurate line/column tracking.
 */

import { TokenType, type Token } from "./types.js";
import { LexerError, type SourceLocation } from "./errors.js";

/** Keywords that map to specific token types */
const KEYWORDS: Record<string, TokenType> = {
  integer: TokenType.KW_Integer,
  float: TokenType.KW_Float,
  string: TokenType.KW_String,
  key: TokenType.KW_Key,
  vector: TokenType.KW_Vector,
  rotation: TokenType.KW_Rotation,
  quaternion: TokenType.KW_Rotation, // alias
  list: TokenType.KW_List,
  if: TokenType.KW_If,
  else: TokenType.KW_Else,
  for: TokenType.KW_For,
  while: TokenType.KW_While,
  do: TokenType.KW_Do,
  jump: TokenType.KW_Jump,
  return: TokenType.KW_Return,
  state: TokenType.KW_State,
  default: TokenType.KW_Default,
};

export class Lexer {
  private source: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  /** Tokenize the full source, returning the token array */
  tokenize(): Token[] {
    this.tokens = [];
    this.pos = 0;
    this.line = 1;
    this.column = 1;

    while (this.pos < this.source.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.source.length) break;

      const ch = this.source[this.pos];

      // String literal
      if (ch === '"') {
        this.readString();
        continue;
      }

      // Number: starts with digit or . followed by digit
      if (this.isDigit(ch) || (ch === "." && this.pos + 1 < this.source.length && this.isDigit(this.source[this.pos + 1]))) {
        this.readNumber();
        continue;
      }

      // Identifier or keyword
      if (this.isIdentStart(ch)) {
        this.readIdentifier();
        continue;
      }

      // Operators and punctuation
      this.readOperator();
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: "",
      loc: this.loc(),
    });

    return this.tokens;
  }

  // === Character classification ===

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isHexDigit(ch: string): boolean {
    return this.isDigit(ch) || (ch >= "a" && ch <= "f") || (ch >= "A" && ch <= "F");
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }

  private isIdentPart(ch: string): boolean {
    return this.isIdentStart(ch) || this.isDigit(ch);
  }

  // === Location tracking ===

  private loc(): SourceLocation {
    return { line: this.line, column: this.column, offset: this.pos };
  }

  private advance(): string {
    const ch = this.source[this.pos];
    this.pos++;
    if (ch === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private peek(offset = 0): string {
    return this.source[this.pos + offset] ?? "\0";
  }

  // === Whitespace and comments ===

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];

      // Whitespace (includes \0 null terminators and \uFEFF BOM from OAR/Windows sources)
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === "\0" || ch === "\uFEFF") {
        this.advance();
        continue;
      }

      // Single-line comment
      if (ch === "/" && this.peek(1) === "/") {
        while (this.pos < this.source.length && this.source[this.pos] !== "\n") {
          this.advance();
        }
        continue;
      }

      // Multi-line comment
      if (ch === "/" && this.peek(1) === "*") {
        const startLoc = this.loc();
        this.advance(); // /
        this.advance(); // *
        while (this.pos < this.source.length) {
          if (this.source[this.pos] === "*" && this.peek(1) === "/") {
            this.advance(); // *
            this.advance(); // /
            break;
          }
          if (this.pos >= this.source.length - 1) {
            throw new LexerError("Unterminated multi-line comment", startLoc, this.source);
          }
          this.advance();
        }
        continue;
      }

      break;
    }
  }

  // === Token readers ===

  private readString(): void {
    const startLoc = this.loc();
    this.advance(); // opening "
    let value = "";

    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];

      if (ch === '"') {
        this.advance(); // closing "
        this.tokens.push({ type: TokenType.StringLiteral, value, loc: startLoc });
        return;
      }

      if (ch === "\\") {
        this.advance(); // backslash
        if (this.pos >= this.source.length) break;
        const escaped = this.advance();
        switch (escaped) {
          case "n": value += "\n"; break;
          case "t": value += "\t"; break;
          case '"': value += '"'; break;
          case "\\": value += "\\"; break;
          default: value += escaped; break;
        }
        continue;
      }

      // LSL strings can contain newlines
      value += this.advance();
    }

    throw new LexerError("Unterminated string literal", startLoc, this.source);
  }

  private readNumber(): void {
    const startLoc = this.loc();
    let value = "";

    // Hex literal: 0x...
    if (this.source[this.pos] === "0" && (this.peek(1) === "x" || this.peek(1) === "X")) {
      value += this.advance(); // 0
      value += this.advance(); // x
      while (this.pos < this.source.length && this.isHexDigit(this.source[this.pos])) {
        value += this.advance();
      }
      this.tokens.push({
        type: TokenType.IntegerLiteral,
        value: String(parseInt(value, 16)),
        loc: startLoc,
      });
      return;
    }

    // Read integer part
    while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
      value += this.advance();
    }

    // Check for decimal point
    let isFloat = false;
    if (this.pos < this.source.length && this.source[this.pos] === ".") {
      // Could be member access if followed by identifier (e.g., vec.x)
      // But in a number context, it's a decimal point
      if (this.pos + 1 < this.source.length && this.isDigit(this.source[this.pos + 1])) {
        isFloat = true;
        value += this.advance(); // .
        while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
          value += this.advance();
        }
      } else if (value.length > 0) {
        // "1." with no trailing digit — still a float in LSL
        isFloat = true;
        value += this.advance(); // .
      } else {
        // ".5" case — started with dot
        isFloat = true;
        value += this.advance(); // .
        while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
          value += this.advance();
        }
      }
    } else if (value.length === 0) {
      // Started with . and read digits already — this is the ".5" case
      isFloat = true;
    }

    // Scientific notation (rare in LSL but valid)
    if (this.pos < this.source.length && (this.source[this.pos] === "e" || this.source[this.pos] === "E")) {
      isFloat = true;
      value += this.advance(); // e/E
      if (this.pos < this.source.length && (this.source[this.pos] === "+" || this.source[this.pos] === "-")) {
        value += this.advance();
      }
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
        value += this.advance();
      }
    }

    if (isFloat) {
      this.tokens.push({ type: TokenType.FloatLiteral, value, loc: startLoc });
    } else {
      this.tokens.push({ type: TokenType.IntegerLiteral, value, loc: startLoc });
    }
  }

  private readIdentifier(): void {
    const startLoc = this.loc();
    let value = "";

    while (this.pos < this.source.length && this.isIdentPart(this.source[this.pos])) {
      value += this.advance();
    }

    // Check if it's a keyword
    const kwType = KEYWORDS[value];
    if (kwType) {
      this.tokens.push({ type: kwType, value, loc: startLoc });
    } else {
      this.tokens.push({ type: TokenType.Identifier, value, loc: startLoc });
    }
  }

  private readOperator(): void {
    const startLoc = this.loc();
    const ch = this.source[this.pos];
    const next = this.peek(1);

    // Two-character operators
    switch (ch + next) {
      case "++": this.advance(); this.advance(); this.tokens.push({ type: TokenType.Increment, value: "++", loc: startLoc }); return;
      case "--": this.advance(); this.advance(); this.tokens.push({ type: TokenType.Decrement, value: "--", loc: startLoc }); return;
      case "+=": this.advance(); this.advance(); this.tokens.push({ type: TokenType.PlusAssign, value: "+=", loc: startLoc }); return;
      case "-=": this.advance(); this.advance(); this.tokens.push({ type: TokenType.MinusAssign, value: "-=", loc: startLoc }); return;
      case "*=": this.advance(); this.advance(); this.tokens.push({ type: TokenType.StarAssign, value: "*=", loc: startLoc }); return;
      case "/=": this.advance(); this.advance(); this.tokens.push({ type: TokenType.SlashAssign, value: "/=", loc: startLoc }); return;
      case "%=": this.advance(); this.advance(); this.tokens.push({ type: TokenType.PercentAssign, value: "%=", loc: startLoc }); return;
      case "==": this.advance(); this.advance(); this.tokens.push({ type: TokenType.Equal, value: "==", loc: startLoc }); return;
      case "!=": this.advance(); this.advance(); this.tokens.push({ type: TokenType.NotEqual, value: "!=", loc: startLoc }); return;
      case "<=": this.advance(); this.advance(); this.tokens.push({ type: TokenType.LessEqual, value: "<=", loc: startLoc }); return;
      case ">=": this.advance(); this.advance(); this.tokens.push({ type: TokenType.GreaterEqual, value: ">=", loc: startLoc }); return;
      case "&&": this.advance(); this.advance(); this.tokens.push({ type: TokenType.And, value: "&&", loc: startLoc }); return;
      case "||": this.advance(); this.advance(); this.tokens.push({ type: TokenType.Or, value: "||", loc: startLoc }); return;
      case "<<": {
        this.advance(); this.advance();
        if (this.peek() === "=") {
          this.advance();
          this.tokens.push({ type: TokenType.ShiftLeftAssign, value: "<<=", loc: startLoc });
        } else {
          this.tokens.push({ type: TokenType.ShiftLeft, value: "<<", loc: startLoc });
        }
        return;
      }
      case ">>": {
        this.advance(); this.advance();
        if (this.peek() === "=") {
          this.advance();
          this.tokens.push({ type: TokenType.ShiftRightAssign, value: ">>=", loc: startLoc });
        } else {
          this.tokens.push({ type: TokenType.ShiftRight, value: ">>", loc: startLoc });
        }
        return;
      }
      case "&=": this.advance(); this.advance(); this.tokens.push({ type: TokenType.BitwiseAndAssign, value: "&=", loc: startLoc }); return;
      case "|=": this.advance(); this.advance(); this.tokens.push({ type: TokenType.BitwiseOrAssign, value: "|=", loc: startLoc }); return;
      case "^=": this.advance(); this.advance(); this.tokens.push({ type: TokenType.BitwiseXorAssign, value: "^=", loc: startLoc }); return;
    }

    // Single-character operators and punctuation
    this.advance();
    switch (ch) {
      case "(": this.tokens.push({ type: TokenType.LeftParen, value: "(", loc: startLoc }); return;
      case ")": this.tokens.push({ type: TokenType.RightParen, value: ")", loc: startLoc }); return;
      case "{": this.tokens.push({ type: TokenType.LeftBrace, value: "{", loc: startLoc }); return;
      case "}": this.tokens.push({ type: TokenType.RightBrace, value: "}", loc: startLoc }); return;
      case "[": this.tokens.push({ type: TokenType.LeftBracket, value: "[", loc: startLoc }); return;
      case "]": this.tokens.push({ type: TokenType.RightBracket, value: "]", loc: startLoc }); return;
      case ";": this.tokens.push({ type: TokenType.Semicolon, value: ";", loc: startLoc }); return;
      case ",": this.tokens.push({ type: TokenType.Comma, value: ",", loc: startLoc }); return;
      case "@": this.tokens.push({ type: TokenType.At, value: "@", loc: startLoc }); return;
      case ".": this.tokens.push({ type: TokenType.Dot, value: ".", loc: startLoc }); return;
      case "+": this.tokens.push({ type: TokenType.Plus, value: "+", loc: startLoc }); return;
      case "-": this.tokens.push({ type: TokenType.Minus, value: "-", loc: startLoc }); return;
      case "*": this.tokens.push({ type: TokenType.Star, value: "*", loc: startLoc }); return;
      case "/": this.tokens.push({ type: TokenType.Slash, value: "/", loc: startLoc }); return;
      case "%": this.tokens.push({ type: TokenType.Percent, value: "%", loc: startLoc }); return;
      case "=": this.tokens.push({ type: TokenType.Assign, value: "=", loc: startLoc }); return;
      case "<": this.tokens.push({ type: TokenType.LeftAngle, value: "<", loc: startLoc }); return;
      case ">": this.tokens.push({ type: TokenType.RightAngle, value: ">", loc: startLoc }); return;
      case "!": this.tokens.push({ type: TokenType.Not, value: "!", loc: startLoc }); return;
      case "&": this.tokens.push({ type: TokenType.BitwiseAnd, value: "&", loc: startLoc }); return;
      case "|": this.tokens.push({ type: TokenType.BitwiseOr, value: "|", loc: startLoc }); return;
      case "^": this.tokens.push({ type: TokenType.BitwiseXor, value: "^", loc: startLoc }); return;
      case "~": this.tokens.push({ type: TokenType.BitwiseNot, value: "~", loc: startLoc }); return;
      default:
        throw new LexerError(`Unexpected character: '${ch}'`, startLoc, this.source);
    }
  }
}

/** Convenience function: tokenize LSL source */
export function tokenize(source: string): Token[] {
  return new Lexer(source).tokenize();
}
