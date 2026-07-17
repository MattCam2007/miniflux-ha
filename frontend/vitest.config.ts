import { defineConfig } from "vitest/config";

// F-U2: the permanent three-ring harness (pure / component / contract) all
// card and atom units build on. F-U1's own bundle smoke test still lives
// under test/ and runs alongside these.
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/global.d.ts"],
    },
  },
});
