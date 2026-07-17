import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MinifluxStore } from "../../src/store/miniflux-store";
import { FakeHass } from "../support/fake-hass";

describe("MinifluxStore.query", () => {
  it("caches a fetch and doesn't refetch on a second call with the same params", async () => {
    const store = new MinifluxStore();
    const fetcher = vi.fn().mockResolvedValue({ feeds: [{ id: 1 }] });

    const first = await store.query("entry-1", "get_feeds", {}, 60000, fetcher);
    const second = await store.query("entry-1", "get_feeds", {}, 60000, fetcher);

    expect(first).toBe(second);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("different params are cached independently", async () => {
    const store = new MinifluxStore();
    const fetcher = vi.fn().mockResolvedValue({ feeds: [] });

    await store.query("entry-1", "get_feeds", { category: 100 }, 60000, fetcher);
    await store.query("entry-1", "get_feeds", { category: 200 }, 60000, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("MinifluxStore targeted invalidation (S4)", () => {
  it("invalidateFeeds drops only this entry's get_feeds queries", async () => {
    const store = new MinifluxStore();
    const fetcher = vi.fn().mockResolvedValue({ feeds: [] });

    await store.query("entry-1", "get_feeds", {}, 60000, fetcher);
    await store.query("entry-1", "get_categories", {}, 60000, fetcher);
    await store.query("entry-2", "get_feeds", {}, 60000, fetcher);

    store.invalidateFeeds("entry-1");

    await store.query("entry-1", "get_feeds", {}, 60000, fetcher); // re-fetched
    await store.query("entry-1", "get_categories", {}, 60000, fetcher); // still cached
    await store.query("entry-2", "get_feeds", {}, 60000, fetcher); // still cached, unrelated entry

    expect(fetcher).toHaveBeenCalledTimes(4); // 3 initial + 1 re-fetch, not 5
  });

  it("invalidateFeedsAndCategories drops both list caches for the entry", async () => {
    const store = new MinifluxStore();
    const fetcher = vi.fn().mockResolvedValue({});

    await store.query("entry-1", "get_feeds", {}, 60000, fetcher);
    await store.query("entry-1", "get_categories", {}, 60000, fetcher);

    store.invalidateFeedsAndCategories("entry-1");

    await store.query("entry-1", "get_feeds", {}, 60000, fetcher);
    await store.query("entry-1", "get_categories", {}, 60000, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});

describe("MinifluxStore bus-driven invalidation", () => {
  it("a bus invalidation clears the whole cache", async () => {
    const store = new MinifluxStore();
    const fetcher = vi.fn().mockResolvedValue({});
    await store.query("entry-1", "get_feeds", {}, 60000, fetcher);

    store.notifyLocalMutation();

    await store.query("entry-1", "get_feeds", {}, 60000, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("MinifluxStore.keysFor", () => {
  it("lists exactly the cached keys for an entry+service", async () => {
    const store = new MinifluxStore();
    const fetcher = vi.fn().mockResolvedValue({});
    await store.query("entry-1", "get_feeds", { category: 100 }, 60000, fetcher);
    await store.query("entry-1", "get_categories", {}, 60000, fetcher);

    expect(store.keysFor("entry-1", "get_feeds")).toHaveLength(1);
  });
});

describe("MinifluxStore hass lifecycle delegation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("attach subscribes the bus to admin events, which invalidate the cache after the debounce", async () => {
    const store = new MinifluxStore();
    const fetcher = vi.fn().mockResolvedValue({});
    await store.query("entry-1", "get_feeds", {}, 60000, fetcher);

    const hass = new FakeHass();
    hass.user.is_admin = true;
    await store.attach(hass);
    hass.fireEvent("miniflux_new_entries", {});
    await vi.advanceTimersByTimeAsync(2000);

    await store.query("entry-1", "get_feeds", {}, 60000, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2); // invalidated by the debounced admin event
  });

  it("onHassUpdate delegates to the bus and can trigger an invalidation", async () => {
    const store = new MinifluxStore();
    const fetcher = vi.fn().mockResolvedValue({});
    await store.query("entry-1", "get_feeds", {}, 60000, fetcher);

    const hass = new FakeHass();
    hass.setState("sensor.miniflux_unread_entries", "5");
    store.onHassUpdate(hass);

    await store.query("entry-1", "get_feeds", {}, 60000, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2); // invalidated by the tick, re-fetched
  });

  it("detach delegates to the bus", async () => {
    const store = new MinifluxStore();
    const hass = new FakeHass();
    hass.user.is_admin = true;
    await store.attach(hass);

    expect(() => store.detach()).not.toThrow();
  });
});
