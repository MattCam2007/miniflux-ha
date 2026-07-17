import { describe, expect, it } from "vitest";

import {
  AmbiguousInstanceError,
  DEFAULT_INSTANCE_KEY,
  NoInstanceConfiguredError,
  listConfigEntryIds,
  resolveConfigEntryId,
  toBackendConfigEntryId,
} from "../../src/api/config-entry";
import { FakeHass } from "../support/fake-hass";

function withMinifluxEntity(hass: FakeHass, entityId: string, configEntryId: string): void {
  hass.entities[entityId] = {
    entity_id: entityId,
    platform: "miniflux",
    config_entry_id: configEntryId,
  };
}

/** Real HA's display registry: a miniflux entity with `platform` set but no
 * config_entry_id (the field the browser never delivers). */
function withDisplayOnlyEntity(hass: FakeHass, entityId: string): void {
  hass.entities[entityId] = {
    entity_id: entityId,
    platform: "miniflux",
    config_entry_id: null,
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

  it("falls back to the default instance token when Miniflux entities exist but expose no config_entry_id (real-HA display registry)", () => {
    const hass = new FakeHass();
    withDisplayOnlyEntity(hass, "sensor.miniflux_unread_entries");
    withDisplayOnlyEntity(hass, "binary_sensor.miniflux_reachable");

    expect(listConfigEntryIds(hass)).toEqual([DEFAULT_INSTANCE_KEY]);
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

  it("auto-resolves to the default instance token in a real-HA display registry", () => {
    const hass = new FakeHass();
    withDisplayOnlyEntity(hass, "sensor.miniflux_unread_entries");

    expect(resolveConfigEntryId(hass)).toBe(DEFAULT_INSTANCE_KEY);
  });

  it("throws NoInstanceConfiguredError when zero are configured", () => {
    const hass = new FakeHass();
    expect(() => resolveConfigEntryId(hass)).toThrow(NoInstanceConfiguredError);
  });

  it("throws AmbiguousInstanceError when multiple real ids exist and none was requested", () => {
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

  it("passes an explicit config_entry_id straight through for the backend to validate", () => {
    const hass = new FakeHass();
    withMinifluxEntity(hass, "sensor.miniflux_unread_entries", "entry-1");

    // The frontend can't validate ids against the display registry, so it
    // trusts an explicit one -- an unknown id is rejected server-side.
    expect(resolveConfigEntryId(hass, "some-other-entry")).toBe("some-other-entry");
  });
});

describe("toBackendConfigEntryId", () => {
  it("strips the default instance token to undefined (backend auto-resolves)", () => {
    expect(toBackendConfigEntryId(DEFAULT_INSTANCE_KEY)).toBeUndefined();
  });

  it("passes a real config entry id through unchanged", () => {
    expect(toBackendConfigEntryId("entry-1")).toBe("entry-1");
  });
});
