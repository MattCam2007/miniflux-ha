import { afterEach, describe, expect, it } from "vitest";

import "../../src/atoms/mf-offline";
import type { MfOffline } from "../../src/atoms/mf-offline";
import { FakeHass } from "../support/fake-hass";
import { cleanupFixtures, fixture, shadowQuery } from "../support/fixture";

afterEach(() => {
  cleanupFixtures();
});

describe("<mf-offline>", () => {
  it("shows the banner when the reachable sensor is off", async () => {
    const hass = new FakeHass();
    hass.setState("binary_sensor.miniflux_reachable", "off");

    const el = await fixture<MfOffline>("mf-offline", { hass });

    expect(shadowQuery(el, ".banner")).not.toBeNull();
  });

  it("hides the banner when the reachable sensor is on", async () => {
    const hass = new FakeHass();
    hass.setState("binary_sensor.miniflux_reachable", "on");

    const el = await fixture<MfOffline>("mf-offline", { hass });

    expect(shadowQuery(el, ".banner")).toBeNull();
  });

  it("treats a missing/unavailable sensor as offline (fails honest, not silent)", async () => {
    const hass = new FakeHass();

    const el = await fixture<MfOffline>("mf-offline", { hass });

    expect(shadowQuery(el, ".banner")).not.toBeNull();
  });

  it("recovers without a reload -- a fresh hass object (as real HA always delivers) updates the banner", async () => {
    const offlineHass = new FakeHass();
    offlineHass.setState("binary_sensor.miniflux_reachable", "off");
    const el = await fixture<MfOffline>("mf-offline", { hass: offlineHass });
    expect(shadowQuery(el, ".banner")).not.toBeNull();

    // Real HA always hands cards a brand-new `hass` object on every
    // update, never mutates the existing one -- simulate that here rather
    // than mutating offlineHass in place, which Lit's dirty-checking would
    // (correctly, for a real hass) treat as a no-op.
    const recoveredHass = new FakeHass();
    recoveredHass.setState("binary_sensor.miniflux_reachable", "on");
    el.hass = recoveredHass;
    await el.updateComplete;

    expect(shadowQuery(el, ".banner")).toBeNull();
  });
});
