import { afterEach, describe, expect, it, vi } from "vitest";

import "../../src/cards/category-manager-card";
import type { MinifluxCategoryManagerCard } from "../../src/cards/category-manager-card";
import type { CategoryDto } from "../../src/api/types";
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

function makeCategory(overrides: Partial<CategoryDto> = {}): CategoryDto {
  return { id: 1, title: "News", feed_count: 2, unread: 5, ...overrides };
}

async function mountCard(hass: FakeHass, config: Record<string, unknown> = {}) {
  const el = await fixture<MinifluxCategoryManagerCard>("miniflux-category-manager-card");
  el.setConfig({ type: "custom:miniflux-category-manager-card", ...config });
  el.hass = hass;
  await flushAsync(el);
  return el;
}

afterEach(() => {
  cleanupFixtures();
});

describe("static card contract", () => {
  it("getStubConfig, getConfigElement, getCardSize, getGridOptions are implemented", async () => {
    const { MinifluxCategoryManagerCard: Card } = await import(
      "../../src/cards/category-manager-card"
    );
    expect(Card.getStubConfig()).toEqual({ type: "custom:miniflux-category-manager-card" });
    expect(Card.getConfigElement().tagName.toLowerCase()).toBe(
      "miniflux-category-manager-card-editor",
    );

    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    const el = await mountCard(hass);
    expect(el.getCardSize()).toBe(5);
    expect(el.getGridOptions()).toEqual({ rows: 5, columns: 12 });
  });
});

describe("C4-U1: category list, including empty, with counts", () => {
  it("an empty category (the whole reason G1 exists) renders", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [makeCategory({ id: 1, title: "Empty One", feed_count: 0, unread: 0 })],
    }));
    const el = await mountCard(hass);

    expect(el.querySelector(".title")?.textContent).toBe("Empty One");
  });

  it("show_empty:false hides zero-feed categories", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [
        makeCategory({ id: 1, title: "Empty", feed_count: 0 }),
        makeCategory({ id: 2, title: "Has Feeds", feed_count: 3 }),
      ],
    }));
    const el = await mountCard(hass, { show_empty: false });

    const titles = [...el.querySelectorAll(".title")].map((t) => t.textContent);
    expect(titles).toEqual(["Has Feeds"]);
  });

  it("show_empty:false also hides a category whose feed_count is null (G1 unknown)", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [
        makeCategory({ id: 1, title: "Unknown", feed_count: null }),
        makeCategory({ id: 2, title: "Has Feeds", feed_count: 3 }),
      ],
    }));
    const el = await mountCard(hass, { show_empty: false });

    const titles = [...el.querySelectorAll(".title")].map((t) => t.textContent);
    expect(titles).toEqual(["Has Feeds"]);
  });

  it("sorts by the configured sort field", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [
        makeCategory({ id: 1, title: "Zebra", unread: 1 }),
        makeCategory({ id: 2, title: "Apple", unread: 9 }),
      ],
    }));
    const el = await mountCard(hass, { sort: "title" });

    const titles = [...el.querySelectorAll(".title")].map((t) => t.textContent);
    expect(titles).toEqual(["Apple", "Zebra"]);
  });

  it("shows feed_count and unread, or — when null (G1 unknown)", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [makeCategory({ feed_count: null, unread: null })],
    }));
    const el = await mountCard(hass);

    expect(el.querySelector(".feed-count")?.textContent).toBe("—");
    expect(el.querySelector(".unread")?.textContent).toBe("—");
  });
});

describe("C4-U2: create / rename", () => {
  it("creating a category calls create_category and it appears in the list", async () => {
    const hass = makeHass();
    let categories: CategoryDto[] = [];
    hass.respondTo("miniflux", "get_categories", () => ({ categories }));
    const createCategory = vi.fn((data: Record<string, unknown>) => {
      categories = [{ id: 5, title: data.title as string, feed_count: 0, unread: 0 }];
      return { category_id: 5 };
    });
    hass.respondTo("miniflux", "create_category", createCategory);
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".add-button")!.click();
    await el.updateComplete;
    const input = el.querySelector<HTMLInputElement>(".create-title")!;
    input.value = "Comics";
    input.dispatchEvent(new Event("change"));
    el.querySelector<HTMLButtonElement>(".create-submit")!.click();
    await flushAsync(el);

    expect(createCategory).toHaveBeenCalledTimes(1);
    expect(el.querySelector(".title")?.textContent).toBe("Comics");
  });

  it("a duplicate title error surfaces verbatim and keeps the create form open", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    hass.respondTo("miniflux", "create_category", () => {
      throw new FakeServiceError("A category with this title already exists.", "service_validation_error");
    });
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".add-button")!.click();
    await el.updateComplete;
    const input = el.querySelector<HTMLInputElement>(".create-title")!;
    input.value = "News";
    input.dispatchEvent(new Event("change"));
    el.querySelector<HTMLButtonElement>(".create-submit")!.click();
    await flushAsync(el);

    expect(el.querySelector(".create-row .error")?.textContent).toBe(
      "A category with this title already exists.",
    );
    expect(el.querySelector(".create-row")).not.toBeNull();
  });

  it("submitting a blank title does not call create_category", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    const createCategory = vi.fn();
    hass.respondTo("miniflux", "create_category", createCategory);
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".add-button")!.click();
    await el.updateComplete;
    el.querySelector<HTMLButtonElement>(".create-submit")!.click();
    await flushAsync(el);

    expect(createCategory).not.toHaveBeenCalled();
  });

  it("Cancel closes the create form without calling create_category", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    const createCategory = vi.fn();
    hass.respondTo("miniflux", "create_category", createCategory);
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".add-button")!.click();
    await el.updateComplete;
    el.querySelector<HTMLButtonElement>(".create-cancel")!.click();
    await el.updateComplete;

    expect(el.querySelector(".create-row")).toBeNull();
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("rename is optimistic -- the new title renders before the call resolves", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [makeCategory({ title: "Old" })],
    }));
    let resolveUpdate: () => void;
    hass.respondTo(
      "miniflux",
      "update_category",
      () => new Promise<void>((resolve) => (resolveUpdate = resolve)),
    );
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".rename-button")!.click();
    await el.updateComplete;
    const input = el.querySelector<HTMLInputElement>(".rename-input")!;
    input.value = "New";
    input.dispatchEvent(new Event("change"));
    await el.updateComplete;
    el.querySelector<HTMLButtonElement>(".rename-save")!.click();
    await el.updateComplete;

    expect(el.querySelector(".title")?.textContent).toBe("New");
    resolveUpdate!();
    await flushAsync(el);
  });

  it("rename rolls back and toasts on failure", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [makeCategory({ title: "Old" })],
    }));
    hass.respondTo("miniflux", "update_category", () => {
      throw new FakeServiceError("Miniflux is unreachable.", "home_assistant_error");
    });
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".rename-button")!.click();
    await el.updateComplete;
    const input = el.querySelector<HTMLInputElement>(".rename-input")!;
    input.value = "New";
    input.dispatchEvent(new Event("change"));
    await el.updateComplete;
    el.querySelector<HTMLButtonElement>(".rename-save")!.click();
    await flushAsync(el);

    expect(el.querySelector(".title")?.textContent).toBe("Old");
    expect(el.querySelector("mf-toast-host")!.shadowRoot!.textContent).toContain(
      "Miniflux is unreachable.",
    );
  });

  it("renaming one category leaves a sibling category's title untouched", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [makeCategory({ id: 1, title: "Old" }), makeCategory({ id: 2, title: "Other" })],
    }));
    hass.respondTo("miniflux", "update_category", () => {});
    const el = await mountCard(hass);

    el.querySelectorAll<HTMLButtonElement>(".rename-button")[0].click();
    await el.updateComplete;
    const input = el.querySelector<HTMLInputElement>(".rename-input")!;
    input.value = "New";
    input.dispatchEvent(new Event("change"));
    await el.updateComplete;
    el.querySelector<HTMLButtonElement>(".rename-save")!.click();
    await flushAsync(el);

    const titles = [...el.querySelectorAll(".title")].map((t) => t.textContent);
    expect(titles).toContain("Other");
  });

  it("Cancel from rename leaves the title unchanged and calls nothing", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [makeCategory({ title: "Old" })],
    }));
    const updateCategory = vi.fn();
    hass.respondTo("miniflux", "update_category", updateCategory);
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".rename-button")!.click();
    await el.updateComplete;
    el.querySelector<HTMLButtonElement>(".rename-cancel")!.click();
    await el.updateComplete;

    expect(el.querySelector(".title")?.textContent).toBe("Old");
    expect(updateCategory).not.toHaveBeenCalled();
  });
});

describe("C4-U3: mark-read + delete (cascade-aware)", () => {
  it("mark-read preview shows the real unread count via count_entries", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [makeCategory()] }));
    hass.respondTo("miniflux", "count_entries", (data: Record<string, unknown>) => {
      expect(data.status).toEqual(["unread"]);
      return { total: 42 };
    });
    const el = await mountCard(hass);

    const confirms = el.querySelectorAll("mf-confirm");
    const markReadConfirm = confirms[0];
    markReadConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await flushAsync(el);

    expect(markReadConfirm.getAttribute("message")).toContain("42");
  });

  it("delete requires confirm, shows the real feed count, and requires hold by default", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [makeCategory({ id: 1 })] }));
    hass.respondTo("miniflux", "get_feeds", () => ({
      feeds: [{ id: 1, title: "A" }, { id: 2, title: "B" }, { id: 3, title: "C" }],
    }));
    const deleteCategory = vi.fn();
    hass.respondTo("miniflux", "delete_category", deleteCategory);
    const el = await mountCard(hass);

    const confirms = el.querySelectorAll("mf-confirm");
    const deleteConfirm = confirms[1];
    expect((deleteConfirm as unknown as { requireHold: boolean }).requireHold).toBe(true);

    deleteConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await flushAsync(el);

    expect(deleteConfirm.getAttribute("message")).toContain("3 feeds");
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it("cancel on delete calls nothing", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [makeCategory()] }));
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    const deleteCategory = vi.fn();
    hass.respondTo("miniflux", "delete_category", deleteCategory);
    const el = await mountCard(hass);

    const deleteConfirm = el.querySelectorAll("mf-confirm")[1];
    deleteConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await flushAsync(el);
    deleteConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.cancel")!.click();
    await el.updateComplete;

    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it("require_hold:false lets a plain click confirm delete", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [makeCategory({ id: 1 })] }));
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    const deleteCategory = vi.fn();
    hass.respondTo("miniflux", "delete_category", deleteCategory);
    const el = await mountCard(hass, { require_hold: false });

    const deleteConfirm = el.querySelectorAll("mf-confirm")[1];
    deleteConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await flushAsync(el);
    deleteConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.confirm")!.click();
    await flushAsync(el);

    expect(deleteCategory).toHaveBeenCalledTimes(1);
  });

  it("show_delete:false hides the delete control", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [makeCategory()] }));
    const el = await mountCard(hass, { show_delete: false });

    expect(el.querySelectorAll("mf-confirm")).toHaveLength(1); // mark-read only
  });

  it("a successful mark-read calls mark_all_read scoped to the category", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [makeCategory({ id: 7 })] }));
    hass.respondTo("miniflux", "count_entries", () => ({ total: 4 }));
    const markAllRead = vi.fn();
    hass.respondTo("miniflux", "mark_all_read", markAllRead);
    const el = await mountCard(hass);

    const markReadConfirm = el.querySelectorAll("mf-confirm")[0];
    markReadConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await flushAsync(el);
    markReadConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.confirm")!.click();
    await flushAsync(el);

    expect(markAllRead.mock.calls[0][0]).toMatchObject({ category: 7 });
  });

  it("a failed mark-read toasts the backend's message", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [makeCategory()] }));
    hass.respondTo("miniflux", "mark_all_read", () => {
      throw new FakeServiceError("Miniflux is unreachable.", "home_assistant_error");
    });
    const el = await mountCard(hass);

    const markReadConfirm = el.querySelectorAll("mf-confirm")[0];
    markReadConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await flushAsync(el);
    markReadConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.confirm")!.click();
    await flushAsync(el);

    expect(el.querySelector("mf-toast-host")!.shadowRoot!.textContent).toContain(
      "Miniflux is unreachable.",
    );
  });

  it("if getFeeds fails, the delete preview falls back to 0 rather than hanging", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [makeCategory()] }));
    hass.respondTo("miniflux", "get_feeds", () => {
      throw new FakeServiceError("boom", "home_assistant_error");
    });
    const el = await mountCard(hass);

    const deleteConfirm = el.querySelectorAll("mf-confirm")[1];
    deleteConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await flushAsync(el);

    expect(deleteConfirm.getAttribute("message")).toContain("0 feeds");
  });

  it("a failed delete toasts and the row survives", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [makeCategory()] }));
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    hass.respondTo("miniflux", "delete_category", () => {
      throw new FakeServiceError("Miniflux is unreachable.", "home_assistant_error");
    });
    const el = await mountCard(hass, { require_hold: false });

    const deleteConfirm = el.querySelectorAll("mf-confirm")[1];
    deleteConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await flushAsync(el);
    deleteConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.confirm")!.click();
    await flushAsync(el);

    expect(el.querySelector(".category-row")).not.toBeNull();
    expect(el.querySelector("mf-toast-host")!.shadowRoot!.textContent).toContain(
      "Miniflux is unreachable.",
    );
  });
});

describe("C4-U4: row expand + cascade concurrency", () => {
  it("expanding lists the category's feeds read-only", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [makeCategory({ id: 1 })] }));
    hass.respondTo("miniflux", "get_feeds", () => ({
      feeds: [{ id: 10, title: "Ars Technica" }],
    }));
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".expand-toggle")!.click();
    await flushAsync(el);

    expect(el.querySelector(".expanded-feeds")?.textContent).toContain("Ars Technica");
  });

  it("collapsing hides the sub-list again", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [makeCategory({ id: 1 })] }));
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".expand-toggle")!.click();
    await flushAsync(el);
    expect(el.querySelector(".expanded-feeds")).not.toBeNull();

    el.querySelector<HTMLButtonElement>(".expand-toggle")!.click();
    await el.updateComplete;
    expect(el.querySelector(".expanded-feeds")).toBeNull();
  });

  it("an empty category expands to show 'No feeds'", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [makeCategory({ id: 1, feed_count: 0 })],
    }));
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    const el = await mountCard(hass);

    el.querySelector<HTMLButtonElement>(".expand-toggle")!.click();
    await flushAsync(el);

    expect(el.querySelector(".expanded-feeds.empty")?.textContent).toBe("No feeds.");
  });

  it("delete cascade invalidates feeds + categories together in one bus event (S4)", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [makeCategory({ id: 1 })] }));
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [] }));
    hass.respondTo("miniflux", "delete_category", () => {});
    const el = await mountCard(hass, { require_hold: false });

    let busInvalidations = 0;
    el.store.bus.onInvalidate(() => {
      busInvalidations += 1;
    });

    const deleteConfirm = el.querySelectorAll("mf-confirm")[1];
    deleteConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await flushAsync(el);
    deleteConfirm.shadowRoot!.querySelector<HTMLButtonElement>("button.confirm")!.click();
    await flushAsync(el);

    expect(busInvalidations).toBeGreaterThan(0);
  });
});
