#!/usr/bin/env npx tsx
/**
 * OutWorldz LSL Corpus Fetcher
 *
 * Downloads free LSL scripts from outworldz.com/lib/ and saves them
 * as a test corpus for the transpiler.
 *
 * Site structure: /lib/ProjectName/ProjectName/Object/*.lsl
 * (3 levels deep from /lib/)
 *
 * Usage:
 *   npx tsx scripts/fetch-outworldz.ts [--limit N] [--delay MS]
 *
 * Writes to: tests/fixtures/lsl/outworldz/
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { get } from "node:https";

const ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "tests/fixtures/lsl/outworldz");
const BASE_URL = "https://outworldz.com/lib/";

// ── CLI args ────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name: string, fallback: number): number {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? parseInt(args[i + 1], 10) : fallback;
}

const LIMIT = getArg("--limit", 0); // 0 = no limit
const DELAY_MS = getArg("--delay", 200); // Be kind to the server

// ── HTTP helper ─────────────────────────────────────────────

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    get(url, { headers: { "User-Agent": "BlackBoxScripter-TestCorpus/1.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (location) {
          const target = location.startsWith("http") ? location : `https://outworldz.com${location}`;
          fetchUrl(target).then(resolve).catch(reject);
          return;
        }
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Parse Apache directory listings ─────────────────────────

function extractHrefs(html: string): string[] {
  // Apache listing duplicates every href. Use a Set to deduplicate.
  const seen = new Set<string>();
  const hrefs: string[] = [];
  const regex = /<a href="([^"]+)">/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith("?") || href.startsWith("/") || href === "../" || href.startsWith(".")) {
      continue;
    }
    if (!seen.has(href)) {
      seen.add(href);
      hrefs.push(href);
    }
  }
  return hrefs;
}

// ── Recursive crawler ───────────────────────────────────────

async function crawlForLsl(
  dirUrl: string,
  maxDepth: number
): Promise<{ url: string; name: string }[]> {
  if (maxDepth <= 0) return [];

  let html: string;
  try {
    html = await fetchUrl(dirUrl);
  } catch {
    return [];
  }

  const hrefs = extractHrefs(html);
  const results: { url: string; name: string }[] = [];

  for (const href of hrefs) {
    const decoded = decodeURIComponent(href);

    if (/\.lsl$/i.test(decoded)) {
      results.push({ url: dirUrl + href, name: decoded });
    } else if (href.endsWith("/")) {
      await sleep(DELAY_MS);
      const sub = await crawlForLsl(dirUrl + href, maxDepth - 1);
      results.push(...sub);
    }
  }

  return results;
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Resume support
  const progressFile = join(OUT_DIR, ".fetch-progress.json");
  let done: Set<string>;
  if (existsSync(progressFile)) {
    done = new Set(JSON.parse(readFileSync(progressFile, "utf-8")));
    console.log(`Resuming: ${done.size} projects already fetched`);
  } else {
    done = new Set();
  }

  // Step 1: Get all project directories
  console.log("Fetching project index from outworldz.com/lib/ ...");
  const indexHtml = await fetchUrl(BASE_URL);
  const projectHrefs = extractHrefs(indexHtml).filter((h) => h.endsWith("/"));

  console.log(`Found ${projectHrefs.length} project directories`);

  let totalScripts = 0;
  let totalProjects = 0;
  let errors = 0;
  let skipped = 0;

  const toFetch = LIMIT > 0 ? projectHrefs.slice(0, LIMIT) : projectHrefs;

  for (const projectHref of toFetch) {
    const projectName = decodeURIComponent(projectHref.replace(/\/$/, ""));

    if (done.has(projectName)) {
      skipped++;
      continue;
    }

    try {
      // Crawl up to 4 levels deep: project/project/Object/*.lsl
      const lslFiles = await crawlForLsl(BASE_URL + projectHref, 4);

      if (lslFiles.length > 0) {
        const projectDir = join(OUT_DIR, sanitize(projectName));
        mkdirSync(projectDir, { recursive: true });

        for (const lsl of lslFiles) {
          try {
            const content = await fetchUrl(lsl.url);
            writeFileSync(join(projectDir, sanitize(lsl.name)), content);
            totalScripts++;
          } catch {
            // Individual file failure — skip
          }
          await sleep(DELAY_MS);
        }
        totalProjects++;
      }

      done.add(projectName);

      if (done.size % 20 === 0) {
        writeFileSync(progressFile, JSON.stringify([...done]));
      }
      if ((totalProjects + errors) % 25 === 0 && (totalProjects + errors) > 0) {
        console.log(
          `  [${done.size}/${toFetch.length}] ${totalProjects} projects, ${totalScripts} scripts, ${errors} errors`
        );
      }
    } catch (err) {
      errors++;
      done.add(projectName); // Don't retry broken projects
      if (errors <= 20) {
        console.error(`  Error: ${projectName}: ${err instanceof Error ? err.message : err}`);
      }
    }

    await sleep(DELAY_MS);
  }

  writeFileSync(progressFile, JSON.stringify([...done]));

  console.log(`\nDone!`);
  console.log(`  Projects with scripts: ${totalProjects}`);
  console.log(`  Total .lsl files:      ${totalScripts}`);
  console.log(`  Skipped (already done): ${skipped}`);
  console.log(`  Errors:                 ${errors}`);
  console.log(`  Output directory:       ${OUT_DIR}`);
}

function sanitize(name: string): string {
  return name.replace(/[<>:"|?*\x00-\x1f]/g, "_").slice(0, 120);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
