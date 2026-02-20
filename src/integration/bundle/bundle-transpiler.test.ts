import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BundleParser } from "./bundle-parser.js";
import { BundleTranspiler } from "./bundle-transpiler.js";

const FIXTURES = resolve(__dirname, "../../../tests/fixtures/bundles");

function loadFixture(name: string) {
  const manifestJson = readFileSync(resolve(FIXTURES, name, "manifest.json"), "utf-8");
  return new BundleParser().parse(manifestJson);
}

function loadScriptSources(fixtureName: string, bundle: ReturnType<BundleParser["parse"]>): Map<string, string> {
  const sources = new Map<string, string>();
  for (const script of bundle.scripts) {
    try {
      const source = readFileSync(resolve(FIXTURES, fixtureName, script.assetPath), "utf-8");
      sources.set(script.assetPath, source);
    } catch {
      // Missing source file — intentional for some tests
    }
  }
  return sources;
}

describe("BundleTranspiler", () => {
  const transpiler = new BundleTranspiler();

  describe("single script (minimal bundle)", () => {
    it("transpiles the minimal bundle successfully", () => {
      const bundle = loadFixture("minimal");
      const sources = loadScriptSources("minimal", bundle);

      const result = transpiler.transpile(bundle, sources);
      expect(result.sceneName).toBe("Minimal Test Scene");
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(result.scripts).toHaveLength(1);
    });

    it("produces valid TypeScript output", () => {
      const bundle = loadFixture("minimal");
      const sources = loadScriptSources("minimal", bundle);

      const result = transpiler.transpile(bundle, sources);
      const script = result.scripts[0];
      expect(script.result.success).toBe(true);
      expect(script.result.code).toContain("class");
      expect(script.result.code).toContain("this.say(0,");
    });

    it("preserves the binding metadata", () => {
      const bundle = loadFixture("minimal");
      const sources = loadScriptSources("minimal", bundle);

      const result = transpiler.transpile(bundle, sources);
      const script = result.scripts[0];
      expect(script.binding.objectId).toBe("obj-uuid-001");
      expect(script.binding.objectName).toBe("Hello Button");
      expect(script.binding.scriptName).toBe("Hello Script");
    });
  });

  describe("multi-script bundle", () => {
    it("transpiles all 4 scripts", () => {
      const bundle = loadFixture("multi-script");
      const sources = loadScriptSources("multi-script", bundle);

      const result = transpiler.transpile(bundle, sources);
      expect(result.scripts).toHaveLength(4);
      expect(result.successCount).toBe(4);
      expect(result.failureCount).toBe(0);
    });

    it("assigns unique class names", () => {
      const bundle = loadFixture("multi-script");
      const sources = loadScriptSources("multi-script", bundle);

      const result = transpiler.transpile(bundle, sources);
      const classNames = result.scripts.map((s) => s.result.className);
      const unique = new Set(classNames);
      expect(unique.size).toBe(classNames.length);
    });

    it("collects diagnostics from all scripts", () => {
      const bundle = loadFixture("multi-script");
      const sources = loadScriptSources("multi-script", bundle);

      const result = transpiler.transpile(bundle, sources);
      // All scripts should transpile — diagnostics should be warnings at most
      const errors = result.diagnostics.filter((d) => d.diagnostic.severity === "error");
      expect(errors).toHaveLength(0);
    });
  });

  describe("missing sources", () => {
    it("records error diagnostic for missing source files", () => {
      const bundle = loadFixture("minimal");
      const emptySources = new Map<string, string>(); // No sources provided

      const result = transpiler.transpile(bundle, emptySources);
      expect(result.failureCount).toBe(1);
      expect(result.successCount).toBe(0);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].diagnostic.message).toContain("not found");
    });

    it("continues transpiling other scripts when one is missing", () => {
      const bundle = loadFixture("multi-script");
      const sources = loadScriptSources("multi-script", bundle);

      // Remove one source
      const firstPath = bundle.scripts[0].assetPath;
      sources.delete(firstPath);

      const result = transpiler.transpile(bundle, sources);
      expect(result.failureCount).toBe(1);
      expect(result.successCount).toBe(3);
      expect(result.scripts).toHaveLength(4);
    });
  });

  describe("invalid LSL source", () => {
    it("records failure for unparseable LSL", () => {
      const bundle = loadFixture("minimal");
      const sources = new Map<string, string>();
      sources.set(bundle.scripts[0].assetPath, "this is not valid LSL {{{");

      const result = transpiler.transpile(bundle, sources);
      expect(result.failureCount).toBe(1);
      expect(result.scripts[0].result.success).toBe(false);
    });
  });

  describe("class name derivation", () => {
    it("converts script names to PascalCase", () => {
      const used = new Set<string>();
      expect(transpiler.deriveClassName("Door Controller", used)).toBe("DoorController");
      expect(transpiler.deriveClassName("my-cool-script", used)).toBe("MyCoolScript");
      expect(transpiler.deriveClassName("hello_world_test", used)).toBe("HelloWorldTest");
    });

    it("handles names starting with non-letters", () => {
      const used = new Set<string>();
      expect(transpiler.deriveClassName("123 script", used)).toBe("Script123Script");
    });

    it("handles special characters", () => {
      const used = new Set<string>();
      expect(transpiler.deriveClassName("script!@#$%", used)).toBe("Script");
    });

    it("deduplicates class names", () => {
      const used = new Set<string>(["Door", "Door_2"]);
      expect(transpiler.deriveClassName("Door", used)).toBe("Door_3");
    });

    it("handles empty string", () => {
      const used = new Set<string>();
      const name = transpiler.deriveClassName("", used);
      expect(name).toMatch(/^Script/);
    });
  });

  describe("transpile options passthrough", () => {
    it("passes options to the transpiler", () => {
      const bundle = loadFixture("minimal");
      const sources = loadScriptSources("minimal", bundle);

      const result = transpiler.transpile(bundle, sources, {
        emitSourceComments: true,
      });
      // The option should be passed through — we just verify it doesn't crash
      expect(result.successCount).toBe(1);
    });
  });
});
