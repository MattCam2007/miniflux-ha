import { describe, expect, it } from "vitest";

import { applyOptimisticPatch } from "../../src/store/optimistic";
import { QueryCache } from "../../src/store/query-cache";

interface FeedListValue {
  feeds: Array<{ id: number; title: string }>;
}

describe("applyOptimisticPatch", () => {
  it("the patch is visible before the mutation resolves (optimism)", async () => {
    const cache = new QueryCache();
    cache.set<FeedListValue>("key", { feeds: [{ id: 1, title: "Old" }] }, 60000);
    let observedDuringMutation: FeedListValue | undefined;

    await applyOptimisticPatch<FeedListValue>(
      cache,
      ["key"],
      (current) => ({ feeds: current.feeds.map((f) => (f.id === 1 ? { ...f, title: "New" } : f)) }),
      60000,
      async () => {
        observedDuringMutation = cache.get<FeedListValue>("key");
      },
    );

    expect(observedDuringMutation?.feeds[0].title).toBe("New");
  });

  it("failure reverts to the exact prior value and reports the error", async () => {
    const cache = new QueryCache();
    const original: FeedListValue = { feeds: [{ id: 1, title: "Old" }] };
    cache.set("key", original, 60000);
    const boom = new Error("Miniflux is unreachable.");

    const outcome = await applyOptimisticPatch<FeedListValue>(
      cache,
      ["key"],
      (current) => ({ feeds: current.feeds.map((f) => ({ ...f, title: "New" })) }),
      60000,
      async () => {
        throw boom;
      },
    );

    expect(outcome).toEqual({ ok: false, error: boom });
    expect(cache.get<FeedListValue>("key")).toEqual(original);
  });

  it("two keys holding the same feed both reflect the patch (S4: two mounted views)", async () => {
    const cache = new QueryCache();
    const value: FeedListValue = { feeds: [{ id: 1, title: "Old" }] };
    cache.set("key-a", value, 60000);
    cache.set("key-b", value, 60000);

    await applyOptimisticPatch<FeedListValue>(
      cache,
      ["key-a", "key-b"],
      (current) => ({ feeds: current.feeds.map((f) => ({ ...f, title: "New" })) }),
      60000,
      async () => {},
    );

    expect(cache.get<FeedListValue>("key-a")?.feeds[0].title).toBe("New");
    expect(cache.get<FeedListValue>("key-b")?.feeds[0].title).toBe("New");
  });

  it("a key that wasn't cached is left uncached after a rollback, not set to undefined-as-a-value", async () => {
    const cache = new QueryCache();

    await applyOptimisticPatch<FeedListValue>(
      cache,
      ["never-cached"],
      (current) => current,
      60000,
      async () => {
        throw new Error("fail");
      },
    );

    expect(cache.get("never-cached")).toBeUndefined();
  });

  it("success returns ok:true and leaves the patched value in place", async () => {
    const cache = new QueryCache();
    cache.set<FeedListValue>("key", { feeds: [{ id: 1, title: "Old" }] }, 60000);

    const outcome = await applyOptimisticPatch<FeedListValue>(
      cache,
      ["key"],
      (current) => ({ feeds: current.feeds.map((f) => ({ ...f, title: "New" })) }),
      60000,
      async () => {},
    );

    expect(outcome).toEqual({ ok: true });
    expect(cache.get<FeedListValue>("key")?.feeds[0].title).toBe("New");
  });
});
