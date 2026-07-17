import { afterEach, describe, expect, it, vi } from "vitest";

import "../../src/cards/category-manager-card-editor";
import type { MinifluxCategoryManagerCardEditor } from "../../src/cards/category-manager-card-editor";
import { cleanupFixtures, fixture, shadowQuery, shadowQueryAll } from "../support/fixture";

afterEach(() => {
  cleanupFixtures();
});

describe("MinifluxCategoryManagerCardEditor", () => {
  it("renders its own fields", async () => {
    const el = await fixture<MinifluxCategoryManagerCardEditor>(
      "miniflux-category-manager-card-editor",
    );
    el.setConfig({ type: "custom:miniflux-category-manager-card" });
    await el.updateComplete;

    expect(shadowQueryAll(el, "input[type=checkbox]")).toHaveLength(3);
    expect(shadowQuery(el, "select")).not.toBeNull();
  });

  it("changing sort dispatches config-changed", async () => {
    const el = await fixture<MinifluxCategoryManagerCardEditor>(
      "miniflux-category-manager-card-editor",
    );
    el.setConfig({ type: "custom:miniflux-category-manager-card" });
    await el.updateComplete;
    const onConfigChanged = vi.fn();
    el.addEventListener("config-changed", (e) => onConfigChanged((e as CustomEvent).detail));

    const select = shadowQuery<HTMLSelectElement>(el, "select")!;
    select.value = "title";
    select.dispatchEvent(new Event("change"));

    expect(onConfigChanged).toHaveBeenCalledWith({
      config: { type: "custom:miniflux-category-manager-card", sort: "title" },
    });
  });

  it("toggling show_empty, show_delete, and require_hold each dispatch config-changed", async () => {
    const el = await fixture<MinifluxCategoryManagerCardEditor>(
      "miniflux-category-manager-card-editor",
    );
    el.setConfig({ type: "custom:miniflux-category-manager-card" });
    await el.updateComplete;
    const onConfigChanged = vi.fn();
    el.addEventListener("config-changed", (e) => onConfigChanged((e as CustomEvent).detail));

    const [showEmpty, showDelete, requireHold] = shadowQueryAll<HTMLInputElement>(
      el,
      "input[type=checkbox]",
    );
    showEmpty.checked = false;
    showEmpty.dispatchEvent(new Event("change"));
    showDelete.checked = false;
    showDelete.dispatchEvent(new Event("change"));
    requireHold.checked = false;
    requireHold.dispatchEvent(new Event("change"));

    expect(onConfigChanged).toHaveBeenCalledTimes(3);
    expect(onConfigChanged.mock.calls[2][0]).toMatchObject({
      config: expect.objectContaining({ require_hold: false }),
    });
  });
});
