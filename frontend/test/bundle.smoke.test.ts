import { describe, expect, it } from "vitest";

// Imports the *committed, built* bundle -- not the TS source -- so this
// test fails if `npm run build` was never run after a source change, same
// as the CI freshness check but from inside the JS test run. The path must
// stay a literal (not a variable) so Vite's import analysis can resolve it.

describe("bundle smoke", () => {
  it("registers the expected custom element on import", async () => {
    await import("../../custom_components/miniflux/frontend/miniflux-cards.js");

    expect(customElements.get("miniflux-spike-card")).toBeDefined();
  });

  it("publishes card-picker metadata", async () => {
    await import("../../custom_components/miniflux/frontend/miniflux-cards.js");

    const entry = window.customCards?.find((c) => c.type === "miniflux-spike-card");
    expect(entry).toBeDefined();
    expect(entry?.name).toBeTruthy();
  });
});
