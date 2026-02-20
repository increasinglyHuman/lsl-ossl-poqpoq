/**
 * CLI Tests — Invoke the CLI as a subprocess to test real-world usage.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const CLI = resolve(ROOT, "src/transpiler/cli.ts");
const FIXTURES = resolve(ROOT, "tests/fixtures");
const TIER1 = join(FIXTURES, "lsl/tier1");
const BUNDLES_MINIMAL = join(FIXTURES, "bundles/minimal");
const BUNDLES_MULTI = join(FIXTURES, "bundles/multi-script");
const TMP = resolve(ROOT, "tests/.tmp-cli");

function run(argStr: string, maxBuffer = 1024 * 1024) {
  const args = argStr ? argStr.split(/\s+/) : [];
  const result = spawnSync("npx", ["tsx", CLI, ...args], {
    encoding: "utf-8",
    cwd: ROOT,
    timeout: 15000,
    maxBuffer,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
});

afterAll(() => {
  if (existsSync(TMP)) {
    rmSync(TMP, { recursive: true, force: true });
  }
});

// ── transpile command ───────────────────────────────────────

describe("transpile", () => {
  it("transpiles a single LSL file to stdout", () => {
    const { stdout } = run(`transpile ${join(TIER1, "DefaultScript.lsl")}`);
    expect(stdout).toContain("class");
    expect(stdout).toContain("WorldScript");
    expect(stdout).toContain("onStateEntry");
  });

  it("outputs JSON with --json", () => {
    const { stdout } = run(`transpile ${join(TIER1, "DefaultScript.lsl")} --json`);
    const result = JSON.parse(stdout);
    expect(result.success).toBe(true);
    expect(result.code).toContain("class");
    expect(result.className).toBeTruthy();
    expect(result.diagnostics).toBeInstanceOf(Array);
  });

  it("writes output to file with -o", () => {
    const outFile = join(TMP, "out-transpile.ts");
    run(`transpile ${join(TIER1, "DefaultScript.lsl")} -o ${outFile}`);
    const contents = readFileSync(outFile, "utf-8");
    expect(contents).toContain("class");
    expect(contents).toContain("WorldScript");
  });

  it("overrides class name with -c", () => {
    const { stdout } = run(
      `transpile ${join(TIER1, "DefaultScript.lsl")} -c MyCustomDoor --json`
    );
    const result = JSON.parse(stdout);
    expect(result.className).toBe("MyCustomDoor");
    expect(result.code).toContain("class MyCustomDoor");
  });

  it("passes --source-comments option through", () => {
    // emitSourceComments is accepted as an option; codegen support is future work.
    // For now just verify the flag doesn't crash and transpilation succeeds.
    const { stdout, exitCode } = run(
      `transpile ${join(TIER1, "DefaultSayAndTouch.lsl")} --source-comments --json`
    );
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.success).toBe(true);
  });

  it("exits 1 for a nonexistent file", () => {
    const { exitCode, stderr } = run(`transpile /tmp/does-not-exist.lsl`);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Cannot read file");
  });

  it("exits 1 for invalid LSL", () => {
    const badFile = join(TMP, "bad.lsl");
    writeFileSync(badFile, "this is not valid LSL at all {{{{");
    const { exitCode, stdout } = run(`transpile ${badFile} --json`);
    expect(exitCode).toBe(1);
    const result = JSON.parse(stdout);
    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("suppresses diagnostics with -q", () => {
    const badFile = join(TMP, "bad-quiet.lsl");
    writeFileSync(badFile, "default { state_entry() { llSay(0, ");
    const { stderr } = run(`transpile ${badFile} -q`);
    expect(stderr).not.toContain("error:");
  });
});

// ── bundle command ──────────────────────────────────────────

describe("bundle", () => {
  it("processes minimal bundle to output directory", () => {
    const outDir = join(TMP, "bundle-minimal");
    run(
      `bundle ${join(BUNDLES_MINIMAL, "manifest.json")} -s ${BUNDLES_MINIMAL} -o ${outDir}`
    );
    const files = readdirSync(outDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f: string) => f.endsWith(".ts"))).toBe(true);
  });

  it("outputs JSON with --json", () => {
    const { stdout } = run(
      `bundle ${join(BUNDLES_MINIMAL, "manifest.json")} -s ${BUNDLES_MINIMAL} --json`
    );
    const result = JSON.parse(stdout);
    expect(result.sceneName).toBe("Minimal Test Scene");
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(0);
    expect(result.scripts).toBeInstanceOf(Array);
    expect(result.scripts.length).toBe(1);
  });

  it("processes multi-script bundle", () => {
    const { stdout } = run(
      `bundle ${join(BUNDLES_MULTI, "manifest.json")} -s ${BUNDLES_MULTI} --json`
    );
    const result = JSON.parse(stdout);
    expect(result.scripts.length).toBe(4);
    expect(result.successCount).toBe(4);
  });

  it("handles missing script sources gracefully", () => {
    const emptyDir = join(TMP, "empty-scripts");
    mkdirSync(emptyDir, { recursive: true });
    const { stdout, exitCode } = run(
      `bundle ${join(BUNDLES_MINIMAL, "manifest.json")} -s ${emptyDir} --json`
    );
    expect(exitCode).toBe(1);
    const result = JSON.parse(stdout);
    expect(result.failureCount).toBeGreaterThan(0);
  });

  it("processes virtuallyHuman 60-script OAR bundle (JSON wrappers)", () => {
    const vhDir = join(FIXTURES, "bundles/virtually_human");
    const { stdout, exitCode } = run(
      `bundle ${join(vhDir, "manifest.json")} -s ${vhDir} --json`,
      50 * 1024 * 1024 // 50MB — large bundle produces ~20MB JSON
    );
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.successCount).toBe(102); // 60 unique scripts, 102 bindings
    expect(result.failureCount).toBe(0);
    expect(result.scripts.length).toBe(102);
  });

  it("exits 2 for invalid manifest JSON", () => {
    const badManifest = join(TMP, "bad-manifest.json");
    writeFileSync(badManifest, "{ not valid json");
    const { exitCode, stderr } = run(`bundle ${badManifest}`);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("Invalid manifest");
  });
});

// ── help / no command ───────────────────────────────────────

describe("help", () => {
  it("prints help with --help", () => {
    const { stderr, exitCode } = run("--help");
    expect(exitCode).toBe(0);
    expect(stderr).toContain("Black Box Scripter");
    expect(stderr).toContain("transpile");
    expect(stderr).toContain("bundle");
  });

  it("prints help with no command", () => {
    const { stderr, exitCode } = run("");
    expect(exitCode).toBe(0);
    expect(stderr).toContain("Black Box Scripter");
  });

  it("exits 1 for unknown command", () => {
    const { exitCode, stderr } = run("frobnicate");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown command");
  });
});
