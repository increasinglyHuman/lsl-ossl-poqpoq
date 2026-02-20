#!/usr/bin/env npx tsx
/**
 * Corpus Transpilation Test — Mass-transpile all .lsl files in a directory.
 *
 * Runs every .lsl file through the transpiler and reports success/failure stats.
 * Useful for stress-testing the parser and codegen against real-world scripts.
 *
 * Usage:
 *   npx tsx scripts/test-corpus.ts [directory]
 *
 * Default directory: tests/fixtures/lsl/outworldz/
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { transpile } from "../src/transpiler/transpile.js";

const ROOT = resolve(import.meta.dirname, "..");
const corpusDir = process.argv[2]
  ? resolve(process.argv[2])
  : join(ROOT, "tests/fixtures/lsl/outworldz");

interface FailureRecord {
  file: string;
  error: string;
  line?: number;
  column?: number;
}

// ── Collect all .lsl files ──────────────────────────────────

function findLslFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(d: string) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.lsl$/i.test(entry)) {
        files.push(full);
      }
    }
  }

  walk(dir);
  return files;
}

// ── Main ────────────────────────────────────────────────────

const lslFiles = findLslFiles(corpusDir);
console.log(`Found ${lslFiles.length} .lsl files in ${relative(ROOT, corpusDir)}`);

let success = 0;
let fail = 0;
const failures: FailureRecord[] = [];
const errorPatterns = new Map<string, number>();

for (const file of lslFiles) {
  const source = readFileSync(file, "utf-8");
  const relPath = relative(corpusDir, file);

  try {
    const result = transpile(source, { filename: relPath });

    if (result.success) {
      success++;
    } else {
      fail++;
      for (const d of result.diagnostics) {
        const pattern = extractPattern(d.message);
        errorPatterns.set(pattern, (errorPatterns.get(pattern) ?? 0) + 1);
        failures.push({
          file: relPath,
          error: d.message,
        });
      }
    }
  } catch (err) {
    fail++;
    const msg = err instanceof Error ? err.message : String(err);
    const pattern = extractPattern(msg);
    errorPatterns.set(pattern, (errorPatterns.get(pattern) ?? 0) + 1);
    failures.push({ file: relPath, error: msg });
  }
}

// ── Report ──────────────────────────────────────────────────

const total = success + fail;
const rate = total > 0 ? ((success / total) * 100).toFixed(1) : "0";

console.log(`\n${"═".repeat(60)}`);
console.log(`  CORPUS TRANSPILATION RESULTS`);
console.log(`${"═".repeat(60)}`);
console.log(`  Total:    ${total} scripts`);
console.log(`  Success:  ${success} (${rate}%)`);
console.log(`  Failed:   ${fail}`);
console.log(`${"═".repeat(60)}`);

if (failures.length > 0) {
  console.log(`\nError pattern summary (top 15):`);
  const sorted = [...errorPatterns.entries()].sort((a, b) => b[1] - a[1]);
  for (const [pattern, count] of sorted.slice(0, 15)) {
    console.log(`  ${String(count).padStart(4)} × ${pattern}`);
  }

  // Write detailed failures to file
  const reportPath = join(ROOT, "tests/fixtures/lsl/outworldz/.corpus-report.json");
  writeFileSync(
    reportPath,
    JSON.stringify({ total, success, fail, rate: `${rate}%`, failures }, null, 2)
  );
  console.log(`\nDetailed report: ${relative(ROOT, reportPath)}`);
}

process.exitCode = fail > 0 ? 1 : 0;

// ── Helpers ─────────────────────────────────────────────────

function extractPattern(msg: string): string {
  // Normalize error messages by removing line/col numbers
  return msg.replace(/\[\d+:\d+\]\s*/, "").replace(/"[^"]*"/g, '"..."');
}
