import { beforeEach, describe, expect, it } from "vitest";

import { NoInstanceConfiguredError } from "../../src/api/config-entry";
import { MinifluxApiError } from "../../src/api/errors";
import { MinifluxApi } from "../../src/api/miniflux-api";
import { FakeHass, FakeServiceError } from "../support/fake-hass";

const CONFIG_ENTRY_ID = "entry-1";

function makeHass(): FakeHass {
  const hass = new FakeHass();
  hass.entities["sensor.miniflux_unread_entries"] = {
    entity_id: "sensor.miniflux_unread_entries",
    platform: "miniflux",
    config_entry_id: CONFIG_ENTRY_ID,
  };
  return hass;
}

describe("MinifluxApi", () => {
  let hass: FakeHass;
  let api: MinifluxApi;

  beforeEach(() => {
    hass = makeHass();
    api = new MinifluxApi();
  });

  it("every call resolves and sends config_entry_id, even though no UI ever picks one (D-3)", async () => {
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    await api.getFeeds(hass);
    expect(hass.calls[0].data.config_entry_id).toBe(CONFIG_ENTRY_ID);
  });

  it("propagates the typed NoInstanceConfiguredError unwrapped, not as MinifluxApiError", async () => {
    const unconfigured = new FakeHass();
    await expect(api.getFeeds(unconfigured)).rejects.toBeInstanceOf(NoInstanceConfiguredError);
  });

  describe("getFeeds", () => {
    it("builds the correct payload and parses the typed response", async () => {
      hass.respondTo("miniflux", "get_feeds", (data) => {
        expect(data).toEqual({ category: 100, config_entry_id: CONFIG_ENTRY_ID });
        return { feeds: [{ id: 1, title: "Example", unread: 3 }] };
      });

      const result = await api.getFeeds(hass, { category: 100 });

      expect(result.feeds[0].unread).toBe(3);
      expect(hass.calls[0].returnResponse).toBe(true);
    });

    it("omits unset optional fields from the payload", async () => {
      hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
      await api.getFeeds(hass);
      expect(hass.calls[0].data).toEqual({ config_entry_id: CONFIG_ENTRY_ID });
    });
  });

  describe("getCategories", () => {
    it("sends only config_entry_id and returns the typed list", async () => {
      hass.respondTo("miniflux", "get_categories", () => ({
        categories: [{ id: 1, title: "News", feed_count: 0, unread: 0 }],
      }));

      const result = await api.getCategories(hass);

      expect(hass.calls[0].data).toEqual({ config_entry_id: CONFIG_ENTRY_ID });
      expect(result.categories).toHaveLength(1);
    });
  });

  describe("countEntries", () => {
    it("encodes the status list and starred flag", async () => {
      hass.respondTo("miniflux", "count_entries", (data) => {
        expect(data).toEqual({
          category: "News",
          status: ["unread"],
          starred: true,
          config_entry_id: CONFIG_ENTRY_ID,
        });
        return { total: 12 };
      });

      const result = await api.countEntries(hass, {
        category: "News",
        status: ["unread"],
        starred: true,
      });

      expect(result.total).toBe(12);
    });
  });

  describe("createFeed", () => {
    it("sends feed_url/category/crawler and returns the new id", async () => {
      hass.respondTo("miniflux", "create_feed", (data) => {
        expect(data).toEqual({
          feed_url: "https://example.com/feed.xml",
          category: 100,
          crawler: true,
          config_entry_id: CONFIG_ENTRY_ID,
        });
        return { feed_id: 42 };
      });

      const result = await api.createFeed(hass, {
        feed_url: "https://example.com/feed.xml",
        category: 100,
        crawler: true,
      });

      expect(result.feed_id).toBe(42);
    });

    it("a duplicate/bad-url error surfaces with the verbatim backend message", async () => {
      hass.respondTo("miniflux", "create_feed", () => {
        throw new FakeServiceError("This feed already exists.", "service_validation_error");
      });

      await expect(
        api.createFeed(hass, { feed_url: "https://example.com/feed.xml" }),
      ).rejects.toMatchObject({ message: "This feed already exists.", retriable: false });
    });
  });

  describe("updateFeed", () => {
    it("sends only the dirty fields it was given, no response requested", async () => {
      hass.respondTo("miniflux", "update_feed", (data) => {
        expect(data).toEqual({ feed: 10, title: "New title", config_entry_id: CONFIG_ENTRY_ID });
      });

      await api.updateFeed(hass, { feed: 10, title: "New title" });

      expect(hass.calls[0].returnResponse).toBe(false);
    });
  });

  describe("deleteFeed", () => {
    it("sends the feed ref only", async () => {
      hass.respondTo("miniflux", "delete_feed", (data) => {
        expect(data).toEqual({ feed: "Ars Technica", config_entry_id: CONFIG_ENTRY_ID });
      });
      await api.deleteFeed(hass, { feed: "Ars Technica" });
    });
  });

  describe("refreshFeed / refreshAllFeeds", () => {
    it("refreshFeed targets exactly one feed", async () => {
      hass.respondTo("miniflux", "refresh_feed", (data) => {
        expect(data).toEqual({ feed: 10, config_entry_id: CONFIG_ENTRY_ID });
      });
      await api.refreshFeed(hass, { feed: 10 });
    });

    it("refreshAllFeeds carries no feed field at all", async () => {
      hass.respondTo("miniflux", "refresh_all_feeds", (data) => {
        expect(data).toEqual({ config_entry_id: CONFIG_ENTRY_ID });
      });
      await api.refreshAllFeeds(hass);
    });
  });

  describe("discoverFeeds", () => {
    it("returns discovered candidates", async () => {
      hass.respondTo("miniflux", "discover_feeds", (data) => {
        expect(data).toEqual({ url: "https://example.com", config_entry_id: CONFIG_ENTRY_ID });
        return { feeds: [{ url: "https://example.com/feed.xml", title: "Example", type: "rss" }] };
      });

      const result = await api.discoverFeeds(hass, { url: "https://example.com" });

      expect(result.feeds).toHaveLength(1);
    });
  });

  describe("markAllRead", () => {
    it("scopes to a feed", async () => {
      hass.respondTo("miniflux", "mark_all_read", (data) => {
        expect(data).toEqual({ feed: 10, config_entry_id: CONFIG_ENTRY_ID });
      });
      await api.markAllRead(hass, { feed: 10 });
    });

    it("scopes to a category", async () => {
      hass.respondTo("miniflux", "mark_all_read", (data) => {
        expect(data).toEqual({ category: "News", config_entry_id: CONFIG_ENTRY_ID });
      });
      await api.markAllRead(hass, { category: "News" });
    });

    it("scopes to everything", async () => {
      hass.respondTo("miniflux", "mark_all_read", (data) => {
        expect(data).toEqual({ everything: true, config_entry_id: CONFIG_ENTRY_ID });
      });
      await api.markAllRead(hass, { everything: true });
    });
  });

  describe("category admin", () => {
    it("createCategory returns the new id", async () => {
      hass.respondTo("miniflux", "create_category", (data) => {
        expect(data).toEqual({ title: "Tech", config_entry_id: CONFIG_ENTRY_ID });
        return { category_id: 7 };
      });
      const result = await api.createCategory(hass, { title: "Tech" });
      expect(result.category_id).toBe(7);
    });

    it("updateCategory sends category ref + new title", async () => {
      hass.respondTo("miniflux", "update_category", (data) => {
        expect(data).toEqual({ category: 7, title: "Renamed", config_entry_id: CONFIG_ENTRY_ID });
      });
      await api.updateCategory(hass, { category: 7, title: "Renamed" });
    });

    it("deleteCategory sends the category ref only", async () => {
      hass.respondTo("miniflux", "delete_category", (data) => {
        expect(data).toEqual({ category: 7, config_entry_id: CONFIG_ENTRY_ID });
      });
      await api.deleteCategory(hass, { category: 7 });
    });
  });

  describe("error propagation", () => {
    it("a connection failure surfaces as a retriable MinifluxApiError", async () => {
      hass.respondTo("miniflux", "refresh_all_feeds", () => {
        throw new FakeServiceError("Miniflux is unreachable.", "home_assistant_error");
      });

      const err = await api.refreshAllFeeds(hass).catch((e) => e);

      expect(err).toBeInstanceOf(MinifluxApiError);
      expect(err.retriable).toBe(true);
      expect(err.message).toBe("Miniflux is unreachable.");
    });
  });
});
