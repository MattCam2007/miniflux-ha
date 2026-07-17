import { describe, expect, it } from "vitest";

import { QueryCache } from "../../src/store/query-cache";

describe("QueryCache", () => {
  it("returns undefined for a key never set", () => {
    const cache = new QueryCache();
    expect(cache.get("missing")).toBeUndefined();
  });

  it("returns the set value before expiry", () => {
    let now = 1000;
    const cache = new QueryCache(() => now);
    cache.set("k", { feeds: [] }, 5000);
    now += 4999;
    expect(cache.get("k")).toEqual({ feeds: [] });
  });

  it("expires exactly at the TTL boundary and re-fetches", () => {
    let now = 1000;
    const cache = new QueryCache(() => now);
    cache.set("k", "value", 5000);
    now += 5000;
    expect(cache.get("k")).toBeUndefined();
  });

  it("a long-TTL key survives a short-TTL key's expiry", () => {
    let now = 1000;
    const cache = new QueryCache(() => now);
    cache.set("short", "s", 1000);
    cache.set("long", "l", 100000);
    now += 1000;
    expect(cache.get("short")).toBeUndefined();
    expect(cache.get("long")).toBe("l");
  });

  it("invalidate removes exactly one key", () => {
    const cache = new QueryCache();
    cache.set("a", 1, 1000);
    cache.set("b", 2, 1000);
    cache.invalidate("a");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
  });

  it("invalidateWhere removes every matching key", () => {
    const cache = new QueryCache();
    cache.set("entry-1 get_feeds []", 1, 1000);
    cache.set("entry-1 get_categories []", 2, 1000);
    cache.set("entry-2 get_feeds []", 3, 1000);

    cache.invalidateWhere((key) => key.startsWith("entry-1"));

    expect(cache.get("entry-1 get_feeds []")).toBeUndefined();
    expect(cache.get("entry-1 get_categories []")).toBeUndefined();
    expect(cache.get("entry-2 get_feeds []")).toBe(3);
  });

  it("keysWhere excludes expired entries", () => {
    let now = 0;
    const cache = new QueryCache(() => now);
    cache.set("stale", 1, 100);
    cache.set("fresh", 2, 100000);
    now += 100;

    expect(cache.keysWhere(() => true)).toEqual(["fresh"]);
  });

  it("clear empties the whole cache", () => {
    const cache = new QueryCache();
    cache.set("a", 1, 1000);
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
  });
});
