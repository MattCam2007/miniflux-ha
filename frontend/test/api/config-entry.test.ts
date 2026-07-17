import { describe, expect, it } from "vitest";

import {
  AmbiguousInstanceError,
  NoInstanceConfiguredError,
  UnknownInstanceError,
  listConfigEntryIds,
  resolveConfigEntryId,
} from "../../src/api/config-entry";
import { FakeHass } from "../support/fake-hass";

function withMinifluxEntity(hass: FakeHass, entityId: string, configEntryId: string): void {
  hass.entities[entityId] = {
    entity_id: entityId,
    platform: "miniflux",
    config_entry_id: configEntryId,
  };
}

describe("listConfigEntryIds", () => {
  it("ignores entities from other platforms", () => {
    const hass = new FakeHass();
    hass.entities["light.kitchen"] = {
      entity_id: "light.kitchen",
      platform: "hue",
      config_entry_id: "hue-entry",
    };

    expect(listConfigEntryIds(hass)).toEqual([]);
  });

  it("dedupes multiple entities from the same config entry", () => {
    const hass = new FakeHass();
    withMinifluxEntity(hass, "sensor.miniflux_unread_entries", "entry-1");
    withMinifluxEntity(hass, "sensor.miniflux_starred_entries", "entry-1");

    expect(listConfigEntryIds(hass)).toEqual(["entry-1"]);
  });

  it("caches the scan by hass.entities object identity", () => {
    const hass = new FakeHass();
    withMinifluxEntity(hass, "sensor.miniflux_unread_entries", "entry-1");

    const first = listConfigEntryIds(hass);
    hass.entities["sensor.miniflux_starred_entries"] = {
      entity_id: "sensor.miniflux_starred_entries",
      platform: "miniflux",
      config_entry_id: "entry-2",
    };
    const second = listConfigEntryIds(hass); // same `entities` object reference

    expect(second).toBe(first); // cached, so the mutation above isn't reflected
  });
});

describe("resolveConfigEntryId", () => {
  it("auto-resolves the single configured instance", () => {
    const hass = new FakeHass();
    withMinifluxEntity(hass, "sensor.miniflux_unread_entries", "entry-1");

    expect(resolveConfigEntryId(hass)).toBe("entry-1");
  });

  it("throws NoInstanceConfiguredError when zero are configured", () => {
    const hass = new FakeHass();
    expect(() => resolveConfigEntryId(hass)).toThrow(NoInstanceConfiguredError);
  });

  it("throws AmbiguousInstanceError when multiple exist and none was requested", () => {
    const hass = new FakeHass();
    withMinifluxEntity(hass, "sensor.miniflux_unread_entries", "entry-1");
    withMinifluxEntity(hass, "sensor.other_unread_entries", "entry-2");

    expect(() => resolveConfigEntryId(hass)).toThrow(AmbiguousInstanceError);
  });

  it("an explicit config_entry_id wins even with multiple configured", () => {
    const hass = new FakeHass();
    withMinifluxEntity(hass, "sensor.miniflux_unread_entries", "entry-1");
    withMinifluxEntity(hass, "sensor.other_unread_entries", "entry-2");

    expect(resolveConfigEntryId(hass, "entry-2")).toBe("entry-2");
  });

  it("an explicit but unknown config_entry_id throws UnknownInstanceError", () => {
    const hass = new FakeHass();
    withMinifluxEntity(hass, "sensor.miniflux_unread_entries", "entry-1");

    expect(() => resolveConfigEntryId(hass, "does-not-exist")).toThrow(UnknownInstanceError);
  });
});
