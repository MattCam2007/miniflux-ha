// CI check (F-U1): the committed bundle must byte-match a fresh build, so a
// release can never ship stale JS. Builds into a temp file and diffs.
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { BUILD_OPTIONS, OUT_FILE } from "./build.mjs";

const tmpDir = mkdtempSync(path.join(tmpdir(), "miniflux-bundle-"));
const freshOutFile = path.join(tmpDir, "miniflux-cards.js");

await build({ ...BUILD_OPTIONS, outfile: freshOutFile });

const fresh = readFileSync(freshOutFile);
const committed = readFileSync(OUT_FILE);

if (!fresh.equals(committed)) {
  console.error(
    "Committed bundle is stale: custom_components/miniflux/frontend/miniflux-cards.js " +
      "does not match a fresh `npm run build` output. Rebuild and commit the result.",
  );
  process.exit(1);
}

console.log("Bundle is fresh.");
