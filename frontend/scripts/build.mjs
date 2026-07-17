import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const BUILD_OPTIONS = {
  entryPoints: [path.resolve(here, "../src/index.ts")],
  bundle: true,
  format: "esm",
  target: ["es2021"],
  minify: true,
  legalComments: "none",
  sourcemap: false,
  logLevel: "info",
};

export const OUT_FILE = path.resolve(
  here,
  "../../custom_components/miniflux/frontend/miniflux-cards.js",
);

async function main() {
  await build({ ...BUILD_OPTIONS, outfile: OUT_FILE });
  console.log(`Built ${OUT_FILE}`);
}

// Only run when invoked directly (not when imported by check-bundle-fresh.mjs).
if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
