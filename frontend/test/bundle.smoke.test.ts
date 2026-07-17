import { describe, expect, it } from "vitest";

// Imports the *committed, built* bundle -- not the TS source -- so this
// test fails if `npm run build` was never run after a source change, same
// as the CI freshness check but from inside the JS test run. The path must
// stay a literal (not a variable) so Vite's import analysis can resolve it.
//
// F-U14: also the bundle's no-leak check -- asserts the built output
// exposes exactly the intended custom elements + window.customCards
// entries, leaks no other globals, and makes no network request at
// import. This first test must run before any other `it` in this file
// imports the bundle (ES module caching means a dynamic import only
// truly evaluates once per file) -- it's the one place that observes the
// real, uncached evaluation.

const EXPECTED_CARD_ELEMENTS = ["miniflux-feed-manager-card", "miniflux-category-manager-card"];
const EXPECTED_EDITOR_ELEMENTS = [
  "miniflux-feed-manager-card-editor",
  "miniflux-category-manager-card-editor",
];

// Lit itself (bundled in, D-5 -- no CDN) registers a few version-tracking
// globals the first time it initializes, independent of anything this
// codebase's own modules do: a dev-mode "multiple Lit versions loaded"
// check and a property-metadata registry. Expected, not a leak.
const EXPECTED_LIT_GLOBALS = [
  "litPropertyMetadata",
  "reactiveElementVersions",
  "litHtmlVersions",
  "litElementVersions",
];

describe("bundle smoke + no-leak (F-U1/F-U14)", () => {
  it("importing the bundle adds exactly window.customCards, and issues no network request", async () => {
    const beforeKeys = new Set(Object.keys(window));
    const fetchSpy = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
      fetchCalled = true;
      return fetchSpy(...args);
    }) as typeof fetch;
    let xhrOpened = false;
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: unknown[]) {
      xhrOpened = true;
      return (originalOpen as (...a: unknown[]) => void).apply(this, args);
    } as typeof originalOpen;

    try {
      await import("../../custom_components/miniflux/frontend/miniflux-cards.js");
    } finally {
      globalThis.fetch = fetchSpy;
      XMLHttpRequest.prototype.open = originalOpen;
    }

    const addedKeys = Object.keys(window).filter((k) => !beforeKeys.has(k));
    expect(addedKeys.sort()).toEqual([...EXPECTED_LIT_GLOBALS, "customCards"].sort());
    expect(fetchCalled).toBe(false);
    expect(xhrOpened).toBe(false);
  });

  it("registers exactly the expected card and editor elements -- nothing extra", async () => {
    await import("../../custom_components/miniflux/frontend/miniflux-cards.js");

    for (const tag of [...EXPECTED_CARD_ELEMENTS, ...EXPECTED_EDITOR_ELEMENTS]) {
      expect(customElements.get(tag), `expected ${tag} to be defined`).toBeDefined();
    }
    // No leftover Phase-1-spike or ad-hoc element name from an earlier unit.
    expect(customElements.get("miniflux-spike-card")).toBeUndefined();
  });

  it("publishes exactly the two Phase 1 cards to window.customCards -- not the editors", async () => {
    await import("../../custom_components/miniflux/frontend/miniflux-cards.js");

    const registeredTypes = window.customCards?.map((c) => c.type) ?? [];
    expect(registeredTypes.sort()).toEqual([...EXPECTED_CARD_ELEMENTS].sort());
  });

  it("every registered card has a non-empty name and description (card-picker requirement)", async () => {
    await import("../../custom_components/miniflux/frontend/miniflux-cards.js");

    for (const entry of window.customCards ?? []) {
      expect(entry.name).toBeTruthy();
      expect(entry.description).toBeTruthy();
    }
  });
});
