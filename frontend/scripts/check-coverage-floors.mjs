#!/usr/bin/env node
// Enforce per-file coverage floors (D-8), the frontend mirror of
// scripts/check_coverage_floors.py. `npm test -- --coverage` (or the
// `coverage` npm script) must run first to produce coverage/coverage-
// summary.json.
import { readFileSync } from "node:fs";
import path from "node:path";

const SUMMARY_PATH = path.resolve("coverage/coverage-summary.json");

// Shared runtime (api, store, pure lib, atom logic) + all backend-adjacent
// glue: 100% line+branch, no exceptions (D-8).
const RUNTIME_PREFIXES = ["src/api/", "src/store/", "src/lib/", "src/atoms/"];
const RUNTIME_FLOOR = 100;

// Card view code (C3/C4 templates): 90% floor.
const CARD_PREFIX = "src/cards/";
const CARD_FLOOR = 90;

// Throwaway/declarative -- no floor. spike-card.ts and index.ts are deleted
// by F-U14 once C3/C4 exist; global.d.ts is types-only and never executed.
const EXEMPT = new Set(["src/index.ts", "src/spike-card.ts", "src/global.d.ts"]);

function floorFor(relPath) {
  if (EXEMPT.has(relPath)) return null;
  if (RUNTIME_PREFIXES.some((p) => relPath.startsWith(p))) return RUNTIME_FLOOR;
  if (relPath.startsWith(CARD_PREFIX)) return CARD_FLOOR;
  return RUNTIME_FLOOR; // default to the strict floor for anything uncategorized
}

function main() {
  let summary;
  try {
    summary = JSON.parse(readFileSync(SUMMARY_PATH, "utf-8"));
  } catch (err) {
    console.error(`::error::${SUMMARY_PATH} not found or unreadable -- run the coverage script first`);
    console.error(String(err));
    return 1;
  }

  const failures = [];
  let checked = 0;
  const repoRoot = process.cwd();

  for (const [absPath, fileSummary] of Object.entries(summary)) {
    if (absPath === "total") continue;
    const relPath = path.relative(repoRoot, absPath).split(path.sep).join("/");
    if (!relPath.startsWith("src/")) continue;

    const floor = floorFor(relPath);
    if (floor === null) continue;
    checked += 1;

    const linePct = fileSummary.lines.pct;
    const branchPct = fileSummary.branches.pct;
    if (linePct < floor || branchPct < floor) {
      failures.push(
        `  ${relPath}: lines ${linePct}% branches ${branchPct}% < floor ${floor}%`,
      );
    }
  }

  if (failures.length > 0) {
    console.error(`Coverage floor violations (${failures.length}):`);
    console.error(failures.join("\n"));
    return 1;
  }

  console.log(`All ${checked} covered files meet their per-module floor.`);
  return 0;
}

process.exit(main());
