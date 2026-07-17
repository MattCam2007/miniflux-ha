import { afterEach, describe, expect, it, vi } from "vitest";

import "../../src/cards/feed-manager-card";
import type { MinifluxFeedManagerCard } from "../../src/cards/feed-manager-card";
import type { FeedDto } from "../../src/api/types";
import { FakeHass, FakeServiceError } from "../support/fake-hass";
import { cleanupFixtures, fixture, flushAsync } from "../support/fixture";

const CONFIG_ENTRY_ID = "entry-1";

function makeHass(): FakeHass {
  const hass = new FakeHass();
  hass.entities["sensor.miniflux_unread_entries"] = {
    entity_id: "sensor.miniflux_unread_entries",
    platform: "miniflux",
    config_entry_id: CONFIG_ENTRY_ID,
  };
  hass.setState("binary_sensor.miniflux_reachable", "on");
  return hass;
}

function makeFeed(overrides: Partial<FeedDto> = {}): FeedDto {
  return {
    id: 1,
    title: "Ars Technica",
    site_url: "https://arstechnica.com",
    feed_url: "https://arstechnica.com/feed",
    category_id: 100,
    category_title: "Tech",
    checked_at: "2026-07-17T09:00:00Z",
    parsing_error_count: 0,
    parsing_error_message: "",
    disabled: false,
    unread: 3,
    ...overrides,
  };
}

async function mountCard(hass: FakeHass, config: Record<string, unknown> = {}) {
  const el = await fixture<MinifluxFeedManagerCard>("miniflux-feed-manager-card");
  el.setConfig({ type: "custom:miniflux-feed-manager-card", ...config });
  el.hass = hass;
  await flushAsync(el);
  return el;
}

afterEach(() => {
  cleanupFixtures();
});

describe("static card contract", () => {
  it("getStubConfig, getConfigElement, getCardSize, getGridOptions are all implemented", async () => {
    const { MinifluxFeedManagerCard: Card } = await import("../../src/cards/feed-manager-card");
    expect(Card.getStubConfig()).toEqual({ type: "custom:miniflux-feed-manager-card" });
    expect(Card.getConfigElement().tagName.toLowerCase()).toBe(
      "miniflux-feed-manager-card-editor",
    );

    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    const el = await mountCard(hass);
    expect(el.getCardSize()).toBe(6);
    expect(el.getGridOptions()).toEqual({ rows: 6, columns: 12 });
  });
});

describe("C3-U1: feed list, grouping, rows", () => {
  it("renders feeds grouped by category with the category title as a heading", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({
      feeds: [
        makeFeed({ id: 1, category_id: 100, category_title: "Tech" }),
        makeFeed({ id: 2, category_id: 200, category_title: "News" }),
      ],
    }));
    const el = await mountCard(hass);

    const headings = [...el.querySelectorAll(".feed-group__title")].map((h) => h.textContent);
    expect(headings).toEqual(["News", "Tech"]);
  });

  it("feeds with no category land in an Uncategorized group", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({
      feeds: [makeFeed({ id: 1, category_id: null, category_title: null })],
    }));
    const el = await mountCard(hass);

    const headings = [...el.querySelectorAll(".feed-group__title")].map((h) => h.textContent);
    expect(headings).toContain("Uncategorized");
  });

  it("a disabled feed gets the paused badge and silenced row style", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed({ disabled: true })] }));
    const el = await mountCard(hass);

    const row = el.querySelector(".feed-row")!;
    expect(row.classList.contains("feed-row--disabled")).toBe(true);
    expect(row.querySelector(".badge--paused")).not.toBeNull();
  });

  it("a feed with parsing errors gets the error badge", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({
      feeds: [makeFeed({ parsing_error_count: 5, parsing_error_message: "boom" })],
    }));
    const el = await mountCard(hass);

    expect(el.querySelector(".badge--error")).not.toBeNull();
  });

  it("renders the G2 unread count, 0 when the snapshot has none", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed({ unread: 0 })] }));
    const el = await mountCard(hass);

    expect(el.querySelector(".unread")?.textContent).toBe("0");
  });

  it("renders a letter monogram avatar (no favicons in Phase 1)", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed({ title: "Zebra" })] }));
    const el = await mountCard(hass);

    expect(el.querySelector(".avatar")?.textContent).toBe("Z");
  });

  it("renders the checked_at age", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed({ checked_at: null })] }));
    const el = await mountCard(hass);

    expect(el.querySelector(".age")?.textContent).toBe("Never checked");
  });

  it("group_by:none renders a flat list with no group headings", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({
      feeds: [makeFeed({ id: 1, category_id: 100 }), makeFeed({ id: 2, category_id: 200 })],
    }));
    const el = await mountCard(hass, { group_by: "none" });

    expect(el.querySelectorAll(".feed-group__title")).toHaveLength(0);
    expect(el.querySelectorAll(".feed-row")).toHaveLength(2);
  });
});

describe("C3-U2: add-feed wizard", () => {
  it("discovering a site URL shows candidates", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    hass.respondTo("miniflux", "discover_feeds", () => ({
      feeds: [{ url: "https://arstechnica.com/feed", title: "Ars Technica", type: "rss" }],
    }));
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".add-button")!.click();
    await el.updateComplete;
    const input = el.querySelector<HTMLInputElement>(".wizard-url")!;
    input.value = "https://arstechnica.com";
    input.dispatchEvent(new Event("change"));
    await flushAsync(el);

    expect(el.querySelector(".candidates")?.textContent).toContain("Ars Technica");
  });

  it("a direct feed URL skips discovery straight to the configure step", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    const discoverFeeds = vi.fn();
    hass.respondTo("miniflux", "discover_feeds", discoverFeeds);
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".add-button")!.click();
    await el.updateComplete;
    const input = el.querySelector<HTMLInputElement>(".wizard-url")!;
    input.value = "https://arstechnica.com/feed.xml";
    input.dispatchEvent(new Event("change"));
    await flushAsync(el);

    expect(discoverFeeds).not.toHaveBeenCalled();
    expect(el.querySelector(".wizard-feed-url")?.textContent).toBe(
      "https://arstechnica.com/feed.xml",
    );
  });

  it("creating a feed (with category + crawler) calls create_feed and closes the wizard", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [{ id: 100, title: "Tech", feed_count: 1, unread: 0 }],
    }));
    const createFeed = vi.fn().mockReturnValue({ feed_id: 1 });
    hass.respondTo("miniflux", "create_feed", createFeed);
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".add-button")!.click();
    await el.updateComplete;
    const input = el.querySelector<HTMLInputElement>(".wizard-url")!;
    input.value = "https://arstechnica.com/feed.xml";
    input.dispatchEvent(new Event("change"));
    await flushAsync(el);

    const checkbox = el.querySelector<HTMLInputElement>('.wizard input[type=checkbox]')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    await el.updateComplete;

    el.querySelector<HTMLButtonElement>(".wizard-subscribe")!.click();
    await flushAsync(el);

    expect(createFeed).toHaveBeenCalledTimes(1);
    expect(createFeed.mock.calls[0][0]).toMatchObject({
      feed_url: "https://arstechnica.com/feed.xml",
      crawler: true,
    });
    expect(el.querySelector(".wizard")).toBeNull();
  });

  it("a duplicate/bad-url error surfaces verbatim and keeps the wizard open", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    hass.respondTo("miniflux", "create_feed", () => {
      throw new FakeServiceError("This feed already exists.", "service_validation_error");
    });
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".add-button")!.click();
    await el.updateComplete;
    const input = el.querySelector<HTMLInputElement>(".wizard-url")!;
    input.value = "https://arstechnica.com/feed.xml";
    input.dispatchEvent(new Event("change"));
    await flushAsync(el);

    el.querySelector<HTMLButtonElement>(".wizard-subscribe")!.click();
    await flushAsync(el);

    expect(el.querySelector(".wizard .error")?.textContent).toBe("This feed already exists.");
    expect(el.querySelector(".wizard")).not.toBeNull();
  });

  it("a discover failure surfaces verbatim and keeps the wizard open", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    hass.respondTo("miniflux", "discover_feeds", () => {
      throw new FakeServiceError("Could not reach that site.", "home_assistant_error");
    });
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".add-button")!.click();
    await el.updateComplete;
    const input = el.querySelector<HTMLInputElement>(".wizard-url")!;
    input.value = "https://unreachable.example.com";
    input.dispatchEvent(new Event("change"));
    await flushAsync(el);

    expect(el.querySelector(".wizard .error")?.textContent).toBe("Could not reach that site.");
    expect(el.querySelector(".wizard")).not.toBeNull();
  });

  it("picking a discovered candidate advances to the configure step", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    hass.respondTo("miniflux", "discover_feeds", () => ({
      feeds: [{ url: "https://arstechnica.com/feed", title: "Ars Technica", type: "rss" }],
    }));
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".add-button")!.click();
    await el.updateComplete;
    const input = el.querySelector<HTMLInputElement>(".wizard-url")!;
    input.value = "https://arstechnica.com";
    input.dispatchEvent(new Event("change"));
    await flushAsync(el);

    el.querySelector<HTMLButtonElement>(".candidates button")!.click();
    await flushAsync(el);

    expect(el.querySelector(".wizard-feed-url")?.textContent).toBe(
      "https://arstechnica.com/feed",
    );
  });

  it("Cancel from the discover step closes the wizard", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".add-button")!.click();
    await el.updateComplete;
    el.querySelector<HTMLButtonElement>(".wizard-cancel")!.click();
    await el.updateComplete;

    expect(el.querySelector(".wizard")).toBeNull();
  });

  it("Cancel from the configure step closes the wizard", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".add-button")!.click();
    await el.updateComplete;
    const input = el.querySelector<HTMLInputElement>(".wizard-url")!;
    input.value = "https://arstechnica.com/feed.xml";
    input.dispatchEvent(new Event("change"));
    await flushAsync(el);

    el.querySelector<HTMLButtonElement>(".wizard-cancel")!.click();
    await el.updateComplete;

    expect(el.querySelector(".wizard")).toBeNull();
  });

  it("picking a category and toggling crawler in the wizard both reach create_feed", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [{ id: 100, title: "Tech", feed_count: 1, unread: 0 }],
    }));
    const createFeed = vi.fn().mockReturnValue({ feed_id: 1 });
    hass.respondTo("miniflux", "create_feed", createFeed);
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".add-button")!.click();
    await el.updateComplete;
    const input = el.querySelector<HTMLInputElement>(".wizard-url")!;
    input.value = "https://arstechnica.com/feed.xml";
    input.dispatchEvent(new Event("change"));
    await flushAsync(el);

    const categoryPicker = el.querySelector("mf-category-picker")!;
    categoryPicker.dispatchEvent(
      new CustomEvent("mf-picked", { detail: { value: 100 } }),
    );
    await el.updateComplete;

    el.querySelector<HTMLButtonElement>(".wizard-subscribe")!.click();
    await flushAsync(el);

    expect(createFeed.mock.calls[0][0]).toMatchObject({ category: 100 });
  });
});

describe("C3-U3: edit sheet", () => {
  it("only the changed fields are sent to update_feed", async () => {
    const hass = makeHass();
    const feed = makeFeed({ id: 1, title: "Ars Technica" });
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [feed] }));
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    const updateFeed = vi.fn();
    hass.respondTo("miniflux", "update_feed", updateFeed);
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".edit-button")!.click();
    await el.updateComplete;
    const feedUrlInput = [...el.querySelectorAll<HTMLInputElement>(".edit-sheet input[type=text]")].find(
      (i) => i.value === feed.feed_url,
    )!;
    feedUrlInput.value = "https://arstechnica.com/new-feed";
    feedUrlInput.dispatchEvent(new Event("change"));
    await el.updateComplete;

    el.querySelector<HTMLButtonElement>(".save-button")!.click();
    await flushAsync(el);

    expect(updateFeed).toHaveBeenCalledTimes(1);
    const [sentData] = updateFeed.mock.calls[0];
    expect(sentData.feed_url).toBe("https://arstechnica.com/new-feed");
    expect(sentData.title).toBeUndefined();
  });

  it("changing the feed_url shows the caution note", async () => {
    const hass = makeHass();
    const feed = makeFeed();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [feed] }));
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".edit-button")!.click();
    await el.updateComplete;
    expect(el.querySelector(".caution")).toBeNull();

    const feedUrlInput = [...el.querySelectorAll<HTMLInputElement>(".edit-sheet input[type=text]")].find(
      (i) => i.value === feed.feed_url,
    )!;
    feedUrlInput.value = "https://different.example.com/feed";
    feedUrlInput.dispatchEvent(new Event("change"));
    await el.updateComplete;

    expect(el.querySelector(".caution")).not.toBeNull();
  });

  it("a rename is optimistic -- the new title renders before the call resolves", async () => {
    const hass = makeHass();
    const feed = makeFeed({ title: "Old Title" });
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [feed] }));
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    let resolveUpdate: () => void;
    hass.respondTo(
      "miniflux",
      "update_feed",
      () => new Promise<void>((resolve) => (resolveUpdate = resolve)),
    );
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".edit-button")!.click();
    await el.updateComplete;
    const titleInput = el.querySelector<HTMLInputElement>('.edit-sheet label input[type=text]')!;
    titleInput.value = "New Title";
    titleInput.dispatchEvent(new Event("change"));
    await el.updateComplete;

    el.querySelector<HTMLButtonElement>(".save-button")!.click();
    await el.updateComplete; // synchronous optimistic patch, before the mutation resolves

    expect(el.querySelector(".title")?.textContent).toBe("New Title");

    resolveUpdate!();
    await flushAsync(el);
  });

  it("rename rolls back and toasts on failure", async () => {
    const hass = makeHass();
    const feed = makeFeed({ title: "Old Title" });
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [feed] }));
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    hass.respondTo("miniflux", "update_feed", () => {
      throw new FakeServiceError("Miniflux is unreachable.", "home_assistant_error");
    });
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".edit-button")!.click();
    await el.updateComplete;
    const titleInput = el.querySelector<HTMLInputElement>('.edit-sheet label input[type=text]')!;
    titleInput.value = "New Title";
    titleInput.dispatchEvent(new Event("change"));
    await el.updateComplete;

    el.querySelector<HTMLButtonElement>(".save-button")!.click();
    await flushAsync(el);

    expect(el.querySelector(".title")?.textContent).toBe("Old Title");
  });

  it("moving a feed to a new category re-queries instead of trusting a local title guess", async () => {
    const hass = makeHass();
    const feed = makeFeed({ id: 1, category_id: 100, category_title: "Tech" });
    let currentFeeds = [feed];
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: currentFeeds }));
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    hass.respondTo("miniflux", "update_feed", () => {
      currentFeeds = [{ ...feed, category_id: 200, category_title: "News" }];
    });
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".edit-button")!.click();
    await el.updateComplete;
    el.querySelector("mf-category-picker")!.dispatchEvent(
      new CustomEvent("mf-picked", { detail: { value: 200 } }),
    );
    await el.updateComplete;

    el.querySelector<HTMLButtonElement>(".save-button")!.click();
    await flushAsync(el);

    expect(el.querySelector(".feed-group__title")?.textContent).toBe("News");
    expect(el.querySelector(".edit-sheet")).toBeNull();
  });

  it("toggling the disabled and crawler checkboxes updates local edit state", async () => {
    const hass = makeHass();
    const feed = makeFeed({ disabled: false });
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [feed] }));
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    const updateFeed = vi.fn();
    hass.respondTo("miniflux", "update_feed", updateFeed);
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".edit-button")!.click();
    await el.updateComplete;
    const [disabledCheckbox, crawlerCheckbox] = el.querySelectorAll<HTMLInputElement>(
      '.edit-sheet input[type=checkbox]',
    );
    disabledCheckbox.checked = true;
    disabledCheckbox.dispatchEvent(new Event("change"));
    crawlerCheckbox.checked = true;
    crawlerCheckbox.dispatchEvent(new Event("change"));
    await el.updateComplete;

    el.querySelector<HTMLButtonElement>(".save-button")!.click();
    await flushAsync(el);

    expect(updateFeed.mock.calls[0][0]).toMatchObject({ disabled: true, crawler: true });
  });

  it("Cancel closes the edit sheet without calling update_feed", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed()] }));
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    const updateFeed = vi.fn();
    hass.respondTo("miniflux", "update_feed", updateFeed);
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".edit-button")!.click();
    await el.updateComplete;
    el.querySelector<HTMLButtonElement>(".cancel-button")!.click();
    await el.updateComplete;

    expect(el.querySelector(".edit-sheet")).toBeNull();
    expect(updateFeed).not.toHaveBeenCalled();
  });
});

describe("C3-U4: row actions", () => {
  it("refresh pends the row then clears once checked_at moves", async () => {
    const hass = makeHass();
    const feed = makeFeed({ checked_at: "2026-07-17T09:00:00Z" });
    let checkedAt = feed.checked_at;
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [{ ...feed, checked_at: checkedAt }] }));
    hass.respondTo("miniflux", "refresh_feed", () => {
      checkedAt = "2026-07-17T09:05:00Z";
    });
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".refresh-button")!.click();
    await el.updateComplete;
    expect(el.querySelector<HTMLButtonElement>(".refresh-button")!.disabled).toBe(true);

    await flushAsync(el);
    expect(el.querySelector<HTMLButtonElement>(".refresh-button")!.disabled).toBe(false);
  });

  it("delete requires confirm and shows the real entry count from count_entries", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed()] }));
    hass.respondTo("miniflux", "count_entries", () => ({ total: 1204 }));
    const deleteFeed = vi.fn();
    hass.respondTo("miniflux", "delete_feed", deleteFeed);
    const el = await mountCard(hass);

    const confirmEl = el.querySelector("mf-confirm")!;
    confirmEl.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await flushAsync(el);

    const message = confirmEl.getAttribute("message");
    expect(message).toContain("1204");
    expect(deleteFeed).not.toHaveBeenCalled();
  });

  it("show_delete:false hides the delete control", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed()] }));
    const el = await mountCard(hass, { show_delete: false });

    expect(el.querySelector("mf-confirm")).toBeNull();
  });

  it("mark-read is scoped to the feed", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed({ id: 42 })] }));
    const markAllRead = vi.fn();
    hass.respondTo("miniflux", "mark_all_read", markAllRead);
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".mark-read-button")!.click();
    await flushAsync(el);

    expect(markAllRead.mock.calls[0][0]).toMatchObject({ feed: 42 });
  });

  it("a disabled feed offers Enable prominently instead of Disable", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed({ disabled: true })] }));
    const el = await mountCard(hass);

    expect(el.querySelector(".enable-button")).not.toBeNull();
    expect(el.querySelector(".disable-button")).toBeNull();
  });

  it("clicking Disable calls update_feed with disabled:true", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed({ disabled: false })] }));
    const updateFeed = vi.fn();
    hass.respondTo("miniflux", "update_feed", updateFeed);
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".disable-button")!.click();
    await flushAsync(el);

    expect(updateFeed.mock.calls[0][0]).toMatchObject({ disabled: true });
  });

  it("clicking Enable calls update_feed with disabled:false", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed({ disabled: true })] }));
    const updateFeed = vi.fn();
    hass.respondTo("miniflux", "update_feed", updateFeed);
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".enable-button")!.click();
    await flushAsync(el);

    expect(updateFeed.mock.calls[0][0]).toMatchObject({ disabled: false });
  });

  it("a failed enable/disable toggle toasts the backend's message", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed({ disabled: false })] }));
    hass.respondTo("miniflux", "update_feed", () => {
      throw new FakeServiceError("Miniflux is unreachable.", "home_assistant_error");
    });
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".disable-button")!.click();
    await flushAsync(el);

    expect(el.querySelector("mf-toast-host")!.shadowRoot!.textContent).toContain(
      "Miniflux is unreachable.",
    );
  });

  it("a failed refresh clears the pending state and toasts", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed()] }));
    hass.respondTo("miniflux", "refresh_feed", () => {
      throw new FakeServiceError("Feed not found.", "not_found");
    });
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".refresh-button")!.click();
    await flushAsync(el);

    expect(el.querySelector<HTMLButtonElement>(".refresh-button")!.disabled).toBe(false);
    expect(el.querySelector("mf-toast-host")!.shadowRoot!.textContent).toContain("Feed not found.");
  });

  it("refresh-all is debounce-guarded at the API layer and toasts on failure", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    hass.respondTo("miniflux", "refresh_all_feeds", () => {
      throw new FakeServiceError("Miniflux is unreachable.", "home_assistant_error");
    });
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".refresh-all-button")!.click();
    await flushAsync(el);

    expect(el.querySelector("mf-toast-host")!.shadowRoot!.textContent).toContain(
      "Miniflux is unreachable.",
    );
  });

  it("a successful refresh-all re-queries the feed list", async () => {
    const hass = makeHass();
    const refreshAllFeeds = vi.fn();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    hass.respondTo("miniflux", "refresh_all_feeds", refreshAllFeeds);
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".refresh-all-button")!.click();
    await flushAsync(el);

    expect(refreshAllFeeds).toHaveBeenCalledTimes(1);
  });

  it("a failed mark-read toasts the backend's message", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed()] }));
    hass.respondTo("miniflux", "mark_all_read", () => {
      throw new FakeServiceError("Miniflux is unreachable.", "home_assistant_error");
    });
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".mark-read-button")!.click();
    await flushAsync(el);

    expect(el.querySelector("mf-toast-host")!.shadowRoot!.textContent).toContain(
      "Miniflux is unreachable.",
    );
  });

  it("if count_entries fails, the delete preview falls back to 0 rather than hanging", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed()] }));
    hass.respondTo("miniflux", "count_entries", () => {
      throw new FakeServiceError("boom", "home_assistant_error");
    });
    const el = await mountCard(hass);

    const confirmEl = el.querySelector("mf-confirm")!;
    confirmEl.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await flushAsync(el);

    expect(confirmEl.getAttribute("message")).toContain("0 entries");
  });

  it("a failed delete toasts the backend's message and the row survives", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed()] }));
    hass.respondTo("miniflux", "count_entries", () => ({ total: 3 }));
    hass.respondTo("miniflux", "delete_feed", () => {
      throw new FakeServiceError("Miniflux is unreachable.", "home_assistant_error");
    });
    const el = await mountCard(hass);

    const confirmEl = el.querySelector("mf-confirm")!;
    confirmEl.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await flushAsync(el);
    confirmEl.shadowRoot!.querySelector<HTMLButtonElement>("button.confirm")!.click();
    await flushAsync(el);

    expect(el.querySelector(".feed-row")).not.toBeNull();
    expect(el.querySelector("mf-toast-host")!.shadowRoot!.textContent).toContain(
      "Miniflux is unreachable.",
    );
  });
});

describe("C3-U5: concurrency & scale", () => {
  it("deleting a feed invalidates both the feed cache and fires a local mutation (S4)", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [makeFeed()] }));
    hass.respondTo("miniflux", "count_entries", () => ({ total: 3 }));
    hass.respondTo("miniflux", "delete_feed", () => {});
    const el = await mountCard(hass);

    let busInvalidations = 0;
    el.store.bus.onInvalidate(() => {
      busInvalidations += 1;
    });

    const confirmEl = el.querySelector("mf-confirm")!;
    confirmEl.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await flushAsync(el);
    confirmEl.shadowRoot!.querySelector<HTMLButtonElement>("button.confirm")!.click();
    await flushAsync(el);

    expect(busInvalidations).toBeGreaterThan(0);
  });

  it("500 feeds render through the virtualized list, not one row per feed in the DOM", async () => {
    const hass = makeHass();
    const feeds = Array.from({ length: 500 }, (_, i) => makeFeed({ id: i, title: `Feed ${i}` }));
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds }));
    const el = await mountCard(hass);

    expect(el.querySelector("mf-virtual-list")).not.toBeNull();
    expect(el.querySelectorAll(".feed-row").length).toBeLessThan(100);
  });
});
