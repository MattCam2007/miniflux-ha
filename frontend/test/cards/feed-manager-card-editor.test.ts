import { afterEach, describe, expect, it, vi } from "vitest";

import "../../src/cards/feed-manager-card-editor";
import type { MinifluxFeedManagerCardEditor } from "../../src/cards/feed-manager-card-editor";
import { cleanupFixtures, fixture, shadowQuery, shadowQueryAll } from "../support/fixture";

afterEach(() => {
  cleanupFixtures();
});

describe("MinifluxFeedManagerCardEditor", () => {
  it("renders its own fields and reflects the config", async () => {
    const el = await fixture<MinifluxFeedManagerCardEditor>("miniflux-feed-manager-card-editor");
    el.setConfig({ type: "custom:miniflux-feed-manager-card", show_delete: false });
    await el.updateComplete;

    const checkboxes = shadowQueryAll<HTMLInputElement>(el, "input[type=checkbox]");
    expect(checkboxes).toHaveLength(3);
  });

  it("toggling show_delete dispatches config-changed with the merged config", async () => {
    const el = await fixture<MinifluxFeedManagerCardEditor>("miniflux-feed-manager-card-editor");
    el.setConfig({ type: "custom:miniflux-feed-manager-card" });
    await el.updateComplete;
    const onConfigChanged = vi.fn();
    el.addEventListener("config-changed", (e) => onConfigChanged((e as CustomEvent).detail));

    const showDeleteCheckbox = shadowQueryAll<HTMLInputElement>(el, "input[type=checkbox]")[1];
    showDeleteCheckbox.checked = false;
    showDeleteCheckbox.dispatchEvent(new Event("change"));

    expect(onConfigChanged).toHaveBeenCalledWith({
      config: { type: "custom:miniflux-feed-manager-card", show_delete: false },
    });
  });

  it("toggling show_add and require_hold both dispatch config-changed", async () => {
    const el = await fixture<MinifluxFeedManagerCardEditor>("miniflux-feed-manager-card-editor");
    el.setConfig({ type: "custom:miniflux-feed-manager-card" });
    await el.updateComplete;
    const onConfigChanged = vi.fn();
    el.addEventListener("config-changed", (e) => onConfigChanged((e as CustomEvent).detail));

    const [showAdd, , requireHold] = shadowQueryAll<HTMLInputElement>(el, "input[type=checkbox]");
    showAdd.checked = false;
    showAdd.dispatchEvent(new Event("change"));
    requireHold.checked = true;
    requireHold.dispatchEvent(new Event("change"));

    expect(onConfigChanged).toHaveBeenCalledTimes(2);
    expect(onConfigChanged.mock.calls[1][0]).toMatchObject({
      config: expect.objectContaining({ require_hold: true }),
    });
  });

  it("changing group_by dispatches config-changed", async () => {
    const el = await fixture<MinifluxFeedManagerCardEditor>("miniflux-feed-manager-card-editor");
    el.setConfig({ type: "custom:miniflux-feed-manager-card" });
    await el.updateComplete;
    const onConfigChanged = vi.fn();
    el.addEventListener("config-changed", (e) => onConfigChanged((e as CustomEvent).detail));

    const select = shadowQuery<HTMLSelectElement>(el, "select")!;
    select.value = "none";
    select.dispatchEvent(new Event("change"));

    expect(onConfigChanged).toHaveBeenCalledWith({
      config: { type: "custom:miniflux-feed-manager-card", group_by: "none" },
    });
  });
});
