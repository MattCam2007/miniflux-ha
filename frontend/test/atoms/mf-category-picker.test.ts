import { afterEach, describe, expect, it, vi } from "vitest";

import "../../src/atoms/mf-category-picker";
import type { MfCategoryPicker } from "../../src/atoms/mf-category-picker";
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

describe("<mf-category-picker>", () => {
  it("an empty category (G1) renders and is selectable", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [{ id: 1, title: "Empty Category", feed_count: 0, unread: 0 }],
    }));

    const el = await fixture<MfCategoryPicker>("mf-category-picker", { hass });
    await flushAsync(el);

    const options = shadowQueryAll<HTMLOptionElement>(el, "option");
    expect(options[1].textContent).toContain("Empty Category");
    expect(options[1].textContent).toContain("(empty)");
    expect(options[1].hasAttribute("disabled")).toBe(false);
  });

  it("emits id vs title per the emit config", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [{ id: 7, title: "News", feed_count: 2, unread: 5 }],
    }));

    const byId = await fixture<MfCategoryPicker>("mf-category-picker", { hass });
    await flushAsync(byId);
    const onPickedId = vi.fn();
    byId.addEventListener("mf-picked", (e) => onPickedId((e as CustomEvent).detail));
    const selectId = shadowQuery<HTMLSelectElement>(byId, "select")!;
    selectId.value = "7";
    selectId.dispatchEvent(new Event("change"));
    expect(onPickedId).toHaveBeenCalledWith({ value: 7 });

    const byTitle = await fixture<MfCategoryPicker>("mf-category-picker", { hass });
    byTitle.emit = "title";
    await flushAsync(byTitle);
    const onPickedTitle = vi.fn();
    byTitle.addEventListener("mf-picked", (e) => onPickedTitle((e as CustomEvent).detail));
    const selectTitle = shadowQuery<HTMLSelectElement>(byTitle, "select")!;
    selectTitle.value = "News";
    selectTitle.dispatchEvent(new Event("change"));
    expect(onPickedTitle).toHaveBeenCalledWith({ value: "News" });
  });

  it("selecting the placeholder option emits nothing", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({
      categories: [{ id: 7, title: "News", feed_count: 2, unread: 5 }],
    }));
    const el = await fixture<MfCategoryPicker>("mf-category-picker", { hass });
    await flushAsync(el);
    const onPicked = vi.fn();
    el.addEventListener("mf-picked", (e) => onPicked((e as CustomEvent).detail));

    const select = shadowQuery<HTMLSelectElement>(el, "select")!;
    select.value = "";
    select.dispatchEvent(new Event("change"));

    expect(onPicked).not.toHaveBeenCalled();
  });

  it("submitting the create form with a blank title does not call create_category", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    const createCategory = vi.fn();
    hass.respondTo("miniflux", "create_category", createCategory);

    const el = await fixture<MfCategoryPicker>("mf-category-picker", { hass });
    el.allowCreate = true;
    await flushAsync(el);

    const select = shadowQuery<HTMLSelectElement>(el, "select")!;
    select.value = "__mf_create_new__";
    select.dispatchEvent(new Event("change"));
    await el.updateComplete;

    const form = shadowQuery<HTMLFormElement>(el, "form")!;
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await flushAsync(el);

    expect(createCategory).not.toHaveBeenCalled();
  });

  it("does not offer '+ New category…' unless allow-create is set", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    const el = await fixture<MfCategoryPicker>("mf-category-picker", { hass });
    await flushAsync(el);

    const texts = shadowQueryAll<HTMLOptionElement>(el, "option").map((o) => o.textContent);
    expect(texts.some((t) => t?.includes("New category"))).toBe(false);
  });

  it("inline-create calls create_category, re-queries, and selects the new category", async () => {
    const hass = makeHass();
    let categories = [{ id: 1, title: "News", feed_count: 1, unread: 2 }];
    hass.respondTo("miniflux", "get_categories", () => ({ categories }));
    const createCategory = vi.fn((data: Record<string, unknown>) => {
      categories = [...categories, { id: 99, title: data.title as string, feed_count: 0, unread: 0 }];
      return { category_id: 99 };
    });
    hass.respondTo("miniflux", "create_category", createCategory);

    const el = await fixture<MfCategoryPicker>("mf-category-picker", { hass });
    el.allowCreate = true;
    await flushAsync(el);
    const onPicked = vi.fn();
    el.addEventListener("mf-picked", (e) => onPicked((e as CustomEvent).detail));

    const select = shadowQuery<HTMLSelectElement>(el, "select")!;
    select.value = "__mf_create_new__";
    select.dispatchEvent(new Event("change"));
    await el.updateComplete;

    const input = shadowQuery<HTMLInputElement>(el, "input[name=title]")!;
    input.value = "Comics";
    const form = shadowQuery<HTMLFormElement>(el, "form")!;
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await flushAsync(el);

    expect(createCategory).toHaveBeenCalledTimes(1);
    expect(createCategory.mock.calls[0][0]).toMatchObject({ title: "Comics" });
    expect(onPicked).toHaveBeenCalledWith({ value: 99 });

    // Back to the select view, with the newly created category now listed.
    const optionTexts = shadowQueryAll<HTMLOptionElement>(el, "option").map((o) =>
      o.textContent?.trim(),
    );
    expect(optionTexts.some((t) => t?.includes("Comics"))).toBe(true);
  });

  it("inline-create emits the new title, not the id, when emit=title", async () => {
    const hass = makeHass();
    let categories: Array<{ id: number; title: string; feed_count: number; unread: number }> = [];
    hass.respondTo("miniflux", "get_categories", () => ({ categories }));
    hass.respondTo("miniflux", "create_category", (data: Record<string, unknown>) => {
      categories = [...categories, { id: 99, title: data.title as string, feed_count: 0, unread: 0 }];
      return { category_id: 99 };
    });

    const el = await fixture<MfCategoryPicker>("mf-category-picker", { hass });
    el.allowCreate = true;
    el.emit = "title";
    await flushAsync(el);
    const onPicked = vi.fn();
    el.addEventListener("mf-picked", (e) => onPicked((e as CustomEvent).detail));

    const select = shadowQuery<HTMLSelectElement>(el, "select")!;
    select.value = "__mf_create_new__";
    select.dispatchEvent(new Event("change"));
    await el.updateComplete;

    const input = shadowQuery<HTMLInputElement>(el, "input[name=title]")!;
    input.value = "Comics";
    shadowQuery<HTMLFormElement>(el, "form")!.dispatchEvent(
      new Event("submit", { cancelable: true }),
    );
    await flushAsync(el);

    expect(onPicked).toHaveBeenCalledWith({ value: "Comics" });
  });

  it("cancel from the create form returns to the select without calling create_category", async () => {
    const hass = makeHass();
    hass.respondTo("miniflux", "get_categories", () => ({ categories: [] }));
    const createCategory = vi.fn();
    hass.respondTo("miniflux", "create_category", createCategory);

    const el = await fixture<MfCategoryPicker>("mf-category-picker", { hass });
    el.allowCreate = true;
    await flushAsync(el);

    const select = shadowQuery<HTMLSelectElement>(el, "select")!;
    select.value = "__mf_create_new__";
    select.dispatchEvent(new Event("change"));
    await el.updateComplete;

    shadowQuery<HTMLButtonElement>(el, "button[type=button]")!.click();
    await el.updateComplete;

    expect(createCategory).not.toHaveBeenCalled();
    expect(shadowQuery(el, "select")).not.toBeNull();
  });
});
