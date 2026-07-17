import { defineConfig } from "vitest/config";

// Minimal harness for F-U1's own bundle smoke test. F-U2 builds the full
// three-ring harness (FakeHass, fixture(), coverage gates) on top of this.
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
  },
});
