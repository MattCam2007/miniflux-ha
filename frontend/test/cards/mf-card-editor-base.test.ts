import { html } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BaseCardConfig } from "../../src/cards/mf-card-editor-base";
import { MfCardEditorBase } from "../../src/cards/mf-card-editor-base";
import { FakeHass } from "../support/fake-hass";
import { cleanupFixtures, fixture, shadowQuery } from "../support/fixture";

interface TestConfig extends BaseCardConfig {
  show_delete?: boolean;
}

class TestEditor extends MfCardEditorBase<TestConfig> {
  protected renderCardFields() {
    return html`<div class="own-field">show_delete: ${String(this._config.show_delete)}</div>`;
  }
}
customElements.define("mf-test-card-editor", TestEditor);

function withMinifluxEntity(hass: FakeHass, entityId: string, configEntryId: string): void {
  hass.entities[entityId] = {
    entity_id: entityId,
    platform: "miniflux",
    config_entry_id: configEntryId,
  };
}

afterEach(() => {
  cleanupFixtures();
});

describe("MfCardEditorBase", () => {
  it("a concrete editor renders only its own fields when one instance is configured", async () => {
    const hass = new FakeHass();
    withMinifluxEntity(hass, "sensor.miniflux_unread_entries", "entry-1");

    const el = await fixture<TestEditor>("mf-test-card-editor", { hass });

    expect(shadowQuery(el, ".own-field")).not.toBeNull();
    expect(shadowQuery(el, ".entry-picker")).toBeNull();
  });

  it("shows the entry picker when multiple instances are configured", async () => {
    const hass = new FakeHass();
    withMinifluxEntity(hass, "sensor.miniflux_unread_entries", "entry-1");
    withMinifluxEntity(hass, "sensor.other_unread_entries", "entry-2");

    const el = await fixture<TestEditor>("mf-test-card-editor", { hass });

    expect(shadowQuery(el, ".entry-picker")).not.toBeNull();
  });

  it("hides the entry picker when zero instances are configured", async () => {
    const hass = new FakeHass();
    const el = await fixture<TestEditor>("mf-test-card-editor", { hass });
    expect(shadowQuery(el, ".entry-picker")).toBeNull();
  });

  it("accepts a stub config via setConfig without error and reflects it", async () => {
    const el = await fixture<TestEditor>("mf-test-card-editor");
    const stub: TestConfig = { type: "custom:miniflux-test-card", show_delete: true };

    expect(() => el.setConfig(stub)).not.toThrow();
    await el.updateComplete;

    expect(shadowQuery(el, ".own-field")?.textContent).toContain("true");
  });

  it("changing the entry picker merges the patch and dispatches config-changed", async () => {
    const hass = new FakeHass();
    withMinifluxEntity(hass, "sensor.miniflux_unread_entries", "entry-1");
    withMinifluxEntity(hass, "sensor.other_unread_entries", "entry-2");
    const el = await fixture<TestEditor>("mf-test-card-editor", { hass });
    el.setConfig({ type: "custom:miniflux-test-card", show_delete: true });
    await el.updateComplete;

    const onConfigChanged = vi.fn();
    el.addEventListener("config-changed", (e) => onConfigChanged((e as CustomEvent).detail));

    const select = shadowQuery<HTMLSelectElement>(el, "select")!;
    select.value = "entry-2";
    select.dispatchEvent(new Event("change"));

    expect(onConfigChanged).toHaveBeenCalledWith({
      config: { type: "custom:miniflux-test-card", show_delete: true, config_entry_id: "entry-2" },
    });
  });
});
