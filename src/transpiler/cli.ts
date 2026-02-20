#!/usr/bin/env node
/**
 * Black Box Scripter CLI — Transpile LSL scripts from the command line.
 *
 * Usage:
 *   blackbox-scripter transpile <input.lsl> [options]
 *   blackbox-scripter bundle <manifest.json> [options]
 *
 * See --help for full usage.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { transpile } from "./transpile.js";
import { BundleParser } from "../integration/bundle/bundle-parser.js";
import { BundleTranspiler } from "../integration/bundle/bundle-transpiler.js";

/** Exit with a message on stderr. TypeScript sees `never` return so flow analysis works. */
function fatal(message: string, code = 1): never {
  process.stderr.write(message);
  process.exit(code);
}

// ── Argument helpers ────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(name: string): boolean {
  return args.includes(name);
}

function getOption(short: string, long: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === short || args[i] === long) && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  return undefined;
}

// ── Help ────────────────────────────────────────────────────

function printHelp(): void {
  const help = `
Black Box Scripter — LSL-to-TypeScript transpiler CLI

Usage:
  blackbox-scripter transpile <input.lsl> [options]
  blackbox-scripter bundle <manifest.json> [options]

Commands:
  transpile   Transpile a single LSL file to TypeScript
  bundle      Batch-transpile all scripts from an OAR manifest

transpile options:
  -o, --output <file>       Write output to file (default: stdout)
  -c, --class-name <name>   Override the generated class name
  --source-comments          Include /* LSL: ... */ comments
  --json                     Output full TranspileResult as JSON
  -q, --quiet                Suppress diagnostics on stderr

bundle options:
  -s, --scripts-dir <dir>   Directory containing LSL files (default: manifest dir)
  -o, --output-dir <dir>    Write .ts files here (default: ./transpiled/)
  --source-comments          Include /* LSL: ... */ comments
  --json                     Output TranspiledBundle as JSON
  -q, --quiet                Suppress diagnostics on stderr

Examples:
  blackbox-scripter transpile door.lsl -o door.ts
  blackbox-scripter transpile script.lsl --json
  blackbox-scripter bundle manifest.json --scripts-dir ./assets/scripts/ -o ./out/
`.trimStart();

  process.stderr.write(help);
}

// ── transpile command ───────────────────────────────────────

function handleTranspile(): void {
  const inputPath = args[1];
  if (!inputPath) {
    printHelp();
    fatal("Error: No input file specified.\n");
  }

  let source: string;
  try {
    source = readFileSync(inputPath, "utf-8");
  } catch {
    fatal(`Error: Cannot read file "${inputPath}".\n`);
  }

  const className = getOption("-c", "--class-name");
  const outputPath = getOption("-o", "--output");
  const json = getFlag("--json");
  const quiet = getFlag("-q") || getFlag("--quiet");
  const sourceComments = getFlag("--source-comments");

  const result = transpile(source, {
    className,
    filename: basename(inputPath),
    emitSourceComments: sourceComments,
  });

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    if (outputPath) {
      writeFileSync(outputPath, result.code);
    } else {
      process.stdout.write(result.code);
    }
    if (!quiet && result.diagnostics.length > 0) {
      for (const d of result.diagnostics) {
        process.stderr.write(`${d.severity}: ${d.message}\n`);
      }
    }
  }

  process.exitCode = result.success ? 0 : 1;
}

// ── bundle command ──────────────────────────────────────────

function handleBundle(): void {
  const manifestPath = args[1];
  if (!manifestPath) {
    printHelp();
    fatal("Error: No manifest file specified.\n");
  }

  let manifestJson: string;
  try {
    manifestJson = readFileSync(manifestPath, "utf-8");
  } catch {
    fatal(`Error: Cannot read manifest "${manifestPath}".\n`);
  }

  const scriptsDir = getOption("-s", "--scripts-dir") ?? dirname(manifestPath);
  const outputDir = getOption("-o", "--output-dir") ?? "./transpiled";
  const json = getFlag("--json");
  const quiet = getFlag("-q") || getFlag("--quiet");
  const sourceComments = getFlag("--source-comments");

  const parser = new BundleParser();
  const transpiler = new BundleTranspiler();

  let bundle;
  try {
    bundle = parser.parse(manifestJson);
  } catch (err) {
    fatal(
      `Error: Invalid manifest — ${err instanceof Error ? err.message : String(err)}\n`,
      2
    );
  }

  // Read all script sources from disk
  // Legacy exports scripts as .json wrappers with a "source" field containing LSL
  const sources = new Map<string, string>();
  for (const script of bundle.scripts) {
    try {
      const fullPath = resolve(scriptsDir, script.assetPath);
      const raw = readFileSync(fullPath, "utf-8");

      if (script.assetPath.endsWith(".json")) {
        const wrapper = JSON.parse(raw);
        if (typeof wrapper.source === "string") {
          sources.set(script.assetPath, wrapper.source);
        }
      } else {
        sources.set(script.assetPath, raw);
      }
    } catch {
      // Missing source — BundleTranspiler handles gracefully
    }
  }

  const result = transpiler.transpile(bundle, sources, {
    emitSourceComments: sourceComments,
  });

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    mkdirSync(outputDir, { recursive: true });
    for (const script of result.scripts) {
      if (script.result.success) {
        writeFileSync(
          resolve(outputDir, `${script.result.className}.ts`),
          script.result.code
        );
      }
    }
  }

  if (!quiet) {
    const total = result.successCount + result.failureCount;
    process.stderr.write(`✓ ${result.successCount}/${total} scripts transpiled\n`);
    for (const d of result.diagnostics) {
      process.stderr.write(`  ✗ ${d.scriptName} (${d.objectName}): ${d.diagnostic.message}\n`);
    }
  }

  process.exitCode = result.failureCount > 0 ? 1 : 0;
}

// ── Entry point ─────────────────────────────────────────────

const command = args[0];

switch (command) {
  case "transpile":
    handleTranspile();
    break;
  case "bundle":
    handleBundle();
    break;
  case "--help":
  case "-h":
    printHelp();
    process.exit(0);
    break;
  default:
    if (command) {
      process.stderr.write(`Unknown command: "${command}"\n\n`);
    }
    printHelp();
    process.exit(command ? 1 : 0);
    break;
}
