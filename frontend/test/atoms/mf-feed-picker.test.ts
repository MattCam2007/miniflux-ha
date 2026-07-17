import { afterEach, describe, expect, it, vi } from "vitest";

import "../../src/atoms/mf-feed-picker";
import type { MfFeedPicker } from "../../src/atoms/mf-feed-picker";
import { MinifluxStore } from "../../src/store/miniflux-store";
import { FakeHass } from "../support/fake-hass";
import { cleanupFixtures, fixture, flushAsync, shadowQuery, shadowQueryAll } from "../support/fixture";

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

afterEach(() => {
  cleanupFixtures();
});

describe("<mf-feed-picker>", () => {
  it("renders an option per feed from get_feeds", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({
      feeds: [
        { id: 1, title: "Ars Technica", unread: 3 },
        { id: 2, title: "The Verge", unread: 0 },
      ],
    }));

    const el = await fixture<MfFeedPicker>("mf-feed-picker", { hass });
    await flushAsync(el);

    const options = shadowQueryAll<HTMLOptionElement>(el, "option");
    expect(options.map((o) => o.textContent?.trim())).toEqual([
      "Select a feed…",
      "Ars Technica",
      "The Verge",
    ]);
  });

  it("shares the cache across two pickers with the same store -- one fetch total", async () => {
    const hass = makeHass();
    const getFeeds = vi.fn().mockReturnValue({ feeds: [{ id: 1, title: "Ars Technica", unread: 0 }] });
    hass.respondTo("miniflux", "get_feeds", getFeeds);
    const sharedStore = new MinifluxStore();

    const first = await fixture<MfFeedPicker>("mf-feed-picker");
    first.store = sharedStore;
    first.hass = hass;
    await flushAsync(first);

    const second = await fixture<MfFeedPicker>("mf-feed-picker");
    second.store = sharedStore;
    second.hass = hass;
    await flushAsync(second);

    expect(getFeeds).toHaveBeenCalledTimes(1);
  });

  it("emits the feed id by default", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({
      feeds: [{ id: 42, title: "Ars Technica", unread: 0 }],
    }));
    const el = await fixture<MfFeedPicker>("mf-feed-picker", { hass });
    await flushAsync(el);
    const onPicked = vi.fn();
    el.addEventListener("mf-picked", (e) => onPicked((e as CustomEvent).detail));

    const select = shadowQuery<HTMLSelectElement>(el, "select")!;
    select.value = "42";
    select.dispatchEvent(new Event("change"));

    expect(onPicked).toHaveBeenCalledWith({ value: 42 });
  });

  it("selecting the placeholder option emits nothing", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({
      feeds: [{ id: 42, title: "Ars Technica", unread: 0 }],
    }));
    const el = await fixture<MfFeedPicker>("mf-feed-picker", { hass });
    await flushAsync(el);
    const onPicked = vi.fn();
    el.addEventListener("mf-picked", (e) => onPicked((e as CustomEvent).detail));

    const select = shadowQuery<HTMLSelectElement>(el, "select")!;
    select.value = "";
    select.dispatchEvent(new Event("change"));

    expect(onPicked).not.toHaveBeenCalled();
  });

  it("emits the feed title when configured to", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({
      feeds: [{ id: 42, title: "Ars Technica", unread: 0 }],
    }));
    const el = await fixture<MfFeedPicker>("mf-feed-picker", { hass });
    el.emit = "title";
    await flushAsync(el);
    const onPicked = vi.fn();
    el.addEventListener("mf-picked", (e) => onPicked((e as CustomEvent).detail));

    const select = shadowQuery<HTMLSelectElement>(el, "select")!;
    select.value = "Ars Technica";
    select.dispatchEvent(new Event("change"));

    expect(onPicked).toHaveBeenCalledWith({ value: "Ars Technica" });
  });
});
