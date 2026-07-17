import { describe, expect, it } from "vitest";

import { cacheKey, keyMatchesEntryAndService } from "../../src/store/cache-key";

describe("cacheKey", () => {
  it("same params in a different key order produce the same key", () => {
    const a = cacheKey("entry-1", "get_feeds", { category: 100, only_with_errors: true });
    const b = cacheKey("entry-1", "get_feeds", { only_with_errors: true, category: 100 });
    expect(a).toBe(b);
  });

  it("different entry ids are isolated even with identical params", () => {
    const a = cacheKey("entry-1", "get_feeds", { category: 100 });
    const b = cacheKey("entry-2", "get_feeds", { category: 100 });
    expect(a).not.toBe(b);
  });

  it("different services for the same entry are isolated", () => {
    const a = cacheKey("entry-1", "get_feeds", {});
    const b = cacheKey("entry-1", "get_categories", {});
    expect(a).not.toBe(b);
  });

  it("undefined-valued params don't affect the key", () => {
    const a = cacheKey("entry-1", "get_feeds", { category: undefined });
    const b = cacheKey("entry-1", "get_feeds", {});
    expect(a).toBe(b);
  });
});

describe("keyMatchesEntryAndService", () => {
  it("matches regardless of params", () => {
    const key = cacheKey("entry-1", "get_feeds", { category: 100 });
    expect(keyMatchesEntryAndService(key, "entry-1", "get_feeds")).toBe(true);
  });

  it("does not match a different entry", () => {
    const key = cacheKey("entry-1", "get_feeds", {});
    expect(keyMatchesEntryAndService(key, "entry-2", "get_feeds")).toBe(false);
  });

  it("does not match a different service", () => {
    const key = cacheKey("entry-1", "get_feeds", {});
    expect(keyMatchesEntryAndService(key, "entry-1", "get_categories")).toBe(false);
  });
});
