# Black Box Scripter CLI — Implementation Spec

**Date:** 2026-02-20
**Status:** Ready to build
**Promise to Legacy:** This CLI is what Legacy needs for pre-transpilation during bundle export.

---

## Overview

A Node.js CLI that exposes the transpiler and bundle pipeline for command-line use. Two modes:

1. **Single file:** `npx blackbox-scripter transpile input.lsl -o output.ts`
2. **Bundle mode:** `npx blackbox-scripter bundle manifest.json --scripts-dir ./assets/scripts/ -o ./transpiled/`

Legacy's `bundle_exporter.py` can shell out to this during export to pre-transpile all LSL scripts.

---

## File

**`src/transpiler/cli.ts`** — Single file, ~150 lines. Uses only Node.js builtins (`fs`, `path`, `process`). No external CLI framework needed.

---

## Commands

### `transpile` — Single file

```bash
npx blackbox-scripter transpile <input.lsl> [options]

Options:
  -o, --output <file>     Write output to file (default: stdout)
  -c, --class-name <name> Override the generated class name
  --source-comments        Include /* LSL: ... */ comments showing original LSL
  --json                   Output as JSON { code, success, diagnostics, className }
  -q, --quiet              Suppress diagnostics on stderr (just output code)
```

**Behavior:**
1. Read `input.lsl` from disk
2. Call `transpile(source, options)` from `src/transpiler/transpile.ts`
3. If `--json`: write full `TranspileResult` as JSON to stdout
4. If `--output`: write `.ts` code to file, diagnostics to stderr
5. If neither: write `.ts` code to stdout, diagnostics to stderr
6. Exit code: 0 if success, 1 if transpilation failed

**Example — Legacy integration (Python):**
```python
import subprocess, json

result = subprocess.run(
    ["npx", "blackbox-scripter", "transpile", script_path, "--json"],
    capture_output=True, text=True
)
data = json.loads(result.stdout)
if data["success"]:
    transpiled_source = data["code"]
    class_name = data["className"]
```

### `bundle` — Batch transpile from OAR manifest

```bash
npx blackbox-scripter bundle <manifest.json> [options]

Options:
  -s, --scripts-dir <dir>  Directory containing LSL script files (default: same dir as manifest)
  -o, --output-dir <dir>   Write transpiled .ts files here (default: ./transpiled/)
  --json                    Output aggregate result as JSON to stdout
  --source-comments         Include LSL source comments in output
  -q, --quiet               Suppress per-script diagnostics
```

**Behavior:**
1. Read `manifest.json` from disk
2. Call `BundleParser.parse(manifestJson)` → `ParsedBundle`
3. For each script in `bundle.scripts`: read `.lsl` file from `--scripts-dir` / asset path
4. Call `BundleTranspiler.transpile(bundle, sources, options)` → `TranspiledBundle`
5. If `--output-dir`: write each transpiled script as `{className}.ts`
6. Write summary to stderr: `✓ 58/60 scripts transpiled (2 failures)`
7. If `--json`: write full `TranspiledBundle` as JSON to stdout
8. Exit code: 0 if all succeeded, 1 if any failed, 2 if manifest parse error

**Example — Legacy integration (Python):**
```python
result = subprocess.run(
    ["npx", "blackbox-scripter", "bundle", manifest_path,
     "--scripts-dir", scripts_dir, "--json"],
    capture_output=True, text=True
)
data = json.loads(result.stdout)
print(f"{data['successCount']}/{data['successCount'] + data['failureCount']} scripts transpiled")
```

---

## Implementation Plan

### 1. Argument parsing (~40 lines)

Hand-rolled from `process.argv` — no external dependencies. Pattern:

```typescript
const args = process.argv.slice(2);
const command = args[0]; // "transpile" | "bundle"

function getFlag(name: string): boolean { ... }
function getOption(name: string): string | undefined { ... }
```

### 2. `transpile` command handler (~40 lines)

```typescript
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { transpile } from "./transpile.js";

async function handleTranspile(args: string[]) {
  const inputPath = args[1];
  const source = readFileSync(inputPath, "utf-8");
  const className = getOption("-c") || getOption("--class-name");
  const outputPath = getOption("-o") || getOption("--output");
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
    if (!quiet) {
      for (const d of result.diagnostics) {
        process.stderr.write(`${d.severity}: ${d.message}\n`);
      }
    }
  }

  process.exit(result.success ? 0 : 1);
}
```

### 3. `bundle` command handler (~50 lines)

```typescript
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { BundleParser } from "../integration/bundle/bundle-parser.js";
import { BundleTranspiler } from "../integration/bundle/bundle-transpiler.js";

async function handleBundle(args: string[]) {
  const manifestPath = args[1];
  const manifestJson = readFileSync(manifestPath, "utf-8");
  const scriptsDir = getOption("-s") || getOption("--scripts-dir") || dirname(manifestPath);
  const outputDir = getOption("-o") || getOption("--output-dir") || "./transpiled";
  const json = getFlag("--json");
  const quiet = getFlag("-q") || getFlag("--quiet");

  const parser = new BundleParser();
  const transpiler = new BundleTranspiler();

  const bundle = parser.parse(manifestJson);
  const sources = new Map<string, string>();
  for (const script of bundle.scripts) {
    try {
      sources.set(script.assetPath, readFileSync(resolve(scriptsDir, script.assetPath), "utf-8"));
    } catch { /* missing source — BundleTranspiler handles gracefully */ }
  }

  const result = transpiler.transpile(bundle, sources, {
    emitSourceComments: getFlag("--source-comments"),
  });

  if (!json) {
    mkdirSync(outputDir, { recursive: true });
    for (const script of result.scripts) {
      if (script.result.success) {
        writeFileSync(resolve(outputDir, `${script.result.className}.ts`), script.result.code);
      }
    }
    if (!quiet) {
      process.stderr.write(`✓ ${result.successCount}/${result.successCount + result.failureCount} scripts transpiled\n`);
      for (const d of result.diagnostics) {
        process.stderr.write(`  ✗ ${d.scriptName} (${d.objectName}): ${d.diagnostic.message}\n`);
      }
    }
  } else {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  }

  process.exit(result.failureCount > 0 ? 1 : 0);
}
```

### 4. Entry point + help (~20 lines)

```typescript
const command = process.argv[2];
switch (command) {
  case "transpile": handleTranspile(process.argv.slice(2)); break;
  case "bundle":    handleBundle(process.argv.slice(2)); break;
  default:          printHelp(); process.exit(0);
}
```

### 5. package.json additions

```json
{
  "bin": {
    "blackbox-scripter": "./dist/transpiler/cli.js"
  },
  "scripts": {
    "transpile": "tsx src/transpiler/cli.ts transpile",
    "bundle": "tsx src/transpiler/cli.ts bundle"
  }
}
```

---

## Tests

**`src/transpiler/cli.test.ts`** — ~15 tests

| Test | What |
|------|------|
| `transpile` single file to stdout | Pipe LSL fixture, verify TS output |
| `transpile --json` | Verify JSON structure with code, success, diagnostics |
| `transpile -o file.ts` | Write to file, verify contents |
| `transpile --class-name MyDoor` | Override class name |
| `transpile --source-comments` | Verify LSL comments in output |
| `transpile` nonexistent file | Exit code 1, error message |
| `transpile` invalid LSL | Exit code 1, diagnostics in stderr |
| `bundle` minimal fixture | Process manifest + scripts → output dir |
| `bundle --json` | Full TranspiledBundle as JSON |
| `bundle` multi-script fixture | All 4 scripts transpiled |
| `bundle` missing scripts | Graceful failure, partial success |
| No command / `--help` | Print usage, exit 0 |
| `transpile -q` | No diagnostics on stderr |

Tests use `child_process.execSync` to invoke the CLI as a subprocess, matching real-world usage.

---

## Dependencies

**None added.** Uses only:
- `node:fs` (readFileSync, writeFileSync, mkdirSync)
- `node:path` (resolve, dirname, basename)
- `process` (argv, stdout, stderr, exit)
- Existing transpiler: `transpile()` from `./transpile.js`
- Existing bundle: `BundleParser`, `BundleTranspiler` from `../integration/bundle/`

The `tsx` dev dependency (already implicit via `npm run transpile`) runs TypeScript directly for development. For production, `tsc` compiles to `dist/transpiler/cli.js`.

---

## Legacy Integration Path

After this CLI is built:

1. Legacy's `bundle_exporter.py` adds an optional `--pre-transpile` flag
2. After copying `.lsl` files to `assets/scripts/`, it runs:
   ```python
   subprocess.run(["npx", "blackbox-scripter", "bundle", manifest_path,
                    "--scripts-dir", scripts_dir, "--json"], ...)
   ```
3. Stores the JSON result in the manifest under `statistics.pre_transpiled: true`
4. World skips transpilation on load when `pre_transpiled` is true

---

## Verification

1. `npm test` — all 473 existing + ~15 new CLI tests pass
2. `npx tsx src/transpiler/cli.ts transpile tests/fixtures/lsl/tier1/hello.lsl` → valid TypeScript
3. `npx tsx src/transpiler/cli.ts bundle tests/fixtures/bundles/multi-script/manifest.json --json` → valid JSON
4. Build: `npm run build` → `dist/transpiler/cli.js` exists and is executable
