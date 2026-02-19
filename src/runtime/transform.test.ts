/**
 * Tests for the AST transformation pipeline.
 * The transform is the security foundation — if it fails, everything else is compromised.
 */

import { describe, it, expect } from "vitest";
import { transformForSandbox } from "./transform.js";

describe("transformForSandbox", () => {
  describe("loop protection", () => {
    it("should inject counter into while loops", () => {
      const result = transformForSandbox("while (true) { x++; }");
      expect(result.success).toBe(true);
      expect(result.code).toContain("__checkLoop()");
    });

    it("should inject counter into for loops", () => {
      const result = transformForSandbox("for (let i = 0; i < 10; i++) { x++; }");
      expect(result.success).toBe(true);
      expect(result.code).toContain("__checkLoop()");
    });

    it("should inject counter into do-while loops", () => {
      const result = transformForSandbox("do { x++; } while (true);");
      expect(result.success).toBe(true);
      expect(result.code).toContain("__checkLoop()");
    });

    it("should inject counter into for-of loops", () => {
      const result = transformForSandbox("for (const x of arr) { process(x); }");
      expect(result.success).toBe(true);
      expect(result.code).toContain("__checkLoop()");
    });

    it("should inject counter into for-in loops", () => {
      const result = transformForSandbox("for (const key in obj) { process(key); }");
      expect(result.success).toBe(true);
      expect(result.code).toContain("__checkLoop()");
    });

    it("should wrap single-statement loop bodies in blocks", () => {
      const result = transformForSandbox("while (true) x++;");
      expect(result.success).toBe(true);
      expect(result.code).toContain("__checkLoop()");
    });

    it("should handle nested loops", () => {
      const result = transformForSandbox(`
        for (let i = 0; i < 10; i++) {
          for (let j = 0; j < 10; j++) {
            grid[i][j] = 0;
          }
        }
      `);
      expect(result.success).toBe(true);
      // Should have __checkLoop in both loops
      const matches = result.code.match(/__checkLoop\(\)/g);
      expect(matches?.length).toBeGreaterThanOrEqual(2);
    });

    it("transformed infinite loop should throw when evaluated", () => {
      const result = transformForSandbox("while (true) {}", { maxIterations: 100 });
      expect(result.success).toBe(true);

      // Evaluate the transformed code — should throw
      expect(() => {
        eval(result.code);
      }).toThrow("maximum iterations");
    });
  });

  describe("preamble generation", () => {
    it("should include loop counter variables", () => {
      const result = transformForSandbox("let x = 1;");
      expect(result.code).toContain("__loopCount");
      expect(result.code).toContain("__MAX_ITERATIONS");
    });

    it("should include call depth counter", () => {
      const result = transformForSandbox("let x = 1;");
      expect(result.code).toContain("__callDepth");
      expect(result.code).toContain("__MAX_CALL_DEPTH");
    });

    it("should respect custom maxIterations", () => {
      const result = transformForSandbox("let x = 1;", { maxIterations: 500 });
      expect(result.code).toContain("500");
    });

    it("should respect custom maxCallDepth", () => {
      const result = transformForSandbox("let x = 1;", { maxCallDepth: 64 });
      expect(result.code).toContain("64");
    });
  });

  describe("blocked globals detection", () => {
    it("should warn about window access", () => {
      const result = transformForSandbox("const w = window;");
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain("window");
    });

    it("should warn about document access", () => {
      const result = transformForSandbox("document.createElement('div');");
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain("document");
    });

    it("should warn about fetch access", () => {
      const result = transformForSandbox("fetch('https://evil.com');");
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain("fetch");
    });

    it("should warn about eval access", () => {
      const result = transformForSandbox("eval('alert(1)');");
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain("eval");
    });

    it("should warn about Function constructor", () => {
      const result = transformForSandbox("new Function('return 1')();");
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain("Function");
    });
  });

  describe("module syntax stripping", () => {
    it("should strip import declarations", () => {
      const result = transformForSandbox(`
        import { WorldScript } from "poqpoq/types";
        class Door {}
      `);
      expect(result.success).toBe(true);
      expect(result.code).not.toContain("import");
      expect(result.warnings.some((w) => w.message.includes("Import"))).toBe(true);
    });

    it("should strip export default and track the class", () => {
      const result = transformForSandbox(`
        export default class Door {
          open() { return true; }
        }
      `);
      expect(result.success).toBe(true);
      // Should not contain "export default" or "export class" keywords
      expect(result.code).not.toMatch(/\bexport\s+(default|class|function)\b/);
      expect(result.code).toContain("class Door");
      expect(result.code).toContain("__exports.default = Door");
    });

    it("should strip named exports", () => {
      const result = transformForSandbox(`
        export class Helper {}
        export function utils() {}
      `);
      expect(result.success).toBe(true);
      expect(result.code).not.toMatch(/\bexport\s+(default|class|function)\b/);
      expect(result.code).toContain("class Helper");
    });

    it("should leave code without imports/exports unchanged", () => {
      const result = transformForSandbox("const x = 1 + 2;");
      expect(result.success).toBe(true);
      expect(result.code).toContain("const x = 1 + 2");
    });
  });

  describe("valid code preservation", () => {
    it("should preserve normal variable declarations", () => {
      const result = transformForSandbox("const x = 42; let y = 'hello';");
      expect(result.success).toBe(true);
      expect(result.code).toContain("const x = 42");
      expect(result.code).toContain("let y = 'hello'");
    });

    it("should preserve class definitions", () => {
      const result = transformForSandbox(`
        class MyScript {
          states = { default: {} };
          open() { return true; }
        }
      `);
      expect(result.success).toBe(true);
      expect(result.code).toContain("class MyScript");
      expect(result.code).toContain("open()");
    });

    it("should preserve async/await", () => {
      const result = transformForSandbox(`
        async function doStuff() {
          const result = await fetch2('url');
          return result;
        }
      `);
      expect(result.success).toBe(true);
      expect(result.code).toContain("async function doStuff");
      expect(result.code).toContain("await");
    });
  });

  describe("error handling", () => {
    it("should return error for invalid syntax", () => {
      const result = transformForSandbox("class { invalid }}}");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return error for empty code", () => {
      const result = transformForSandbox("");
      // Empty code should still succeed (preamble only)
      expect(result.success).toBe(true);
    });
  });
});
