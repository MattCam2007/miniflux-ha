import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RefreshBus } from "../../src/store/refresh-bus";
import { FakeHass } from "../support/fake-hass";

describe("RefreshBus admin events (S2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("20 events within 1s collapse into exactly one invalidation after the debounce", async () => {
    const hass = new FakeHass();
    hass.user.is_admin = true;
    const bus = new RefreshBus();
    let invalidations = 0;
    bus.onInvalidate(() => {
      invalidations += 1;
    });

    await bus.attachAdminEvents(hass);

    for (let i = 0; i < 20; i++) {
      hass.fireEvent("miniflux_new_entries", {});
      await vi.advanceTimersByTimeAsync(50); // 20 * 50ms = 1s total
    }
    expect(invalidations).toBe(0); // still within the 2s debounce window

    await vi.advanceTimersByTimeAsync(2000);
    expect(invalidations).toBe(1);
  });

  it("is_admin:false never subscribes to bus events; entity ticks still invalidate (G4/S9)", async () => {
    const hass = new FakeHass();
    hass.user.is_admin = false;
    const bus = new RefreshBus();
    let invalidations = 0;
    bus.onInvalidate(() => {
      invalidations += 1;
    });

    await bus.attachAdminEvents(hass);
    hass.fireEvent("miniflux_new_entries", {}); // no-op: never subscribed
    expect(invalidations).toBe(0);

    hass.setState("sensor.miniflux_unread_entries", "5");
    bus.onHassUpdate(hass);
    expect(invalidations).toBe(1);
  });

  it("attachAdminEvents is idempotent -- a second call doesn't double-subscribe", async () => {
    const hass = new FakeHass();
    hass.user.is_admin = true;
    const bus = new RefreshBus();
    let invalidations = 0;
    bus.onInvalidate(() => {
      invalidations += 1;
    });

    await bus.attachAdminEvents(hass);
    await bus.attachAdminEvents(hass);

    hass.fireEvent("miniflux_new_entries", {});
    await vi.advanceTimersByTimeAsync(2000);

    expect(invalidations).toBe(1); // not 2 -- a double subscription would fire the callback twice
  });
});

describe("RefreshBus entity ticks (S9)", () => {
  it("onHassUpdate invalidates immediately, no debounce", () => {
    const hass = new FakeHass();
    const bus = new RefreshBus();
    let invalidations = 0;
    bus.onInvalidate(() => {
      invalidations += 1;
    });

    hass.setState("sensor.miniflux_unread_entries", "5");
    bus.onHassUpdate(hass);

    expect(invalidations).toBe(1);
  });

  it("an unchanged hass (same last_changed) does not re-invalidate", () => {
    const hass = new FakeHass();
    const bus = new RefreshBus();
    let invalidations = 0;
    bus.onInvalidate(() => {
      invalidations += 1;
    });

    hass.setState("sensor.miniflux_unread_entries", "5");
    bus.onHassUpdate(hass);
    bus.onHassUpdate(hass); // same states object, nothing moved

    expect(invalidations).toBe(1);
  });

  it("only a tracked entity's change triggers invalidation", () => {
    const hass = new FakeHass();
    const bus = new RefreshBus();
    let invalidations = 0;
    bus.onInvalidate(() => {
      invalidations += 1;
    });
    bus.onHassUpdate(hass); // baseline, nothing tracked yet

    hass.setState("light.kitchen", "on");
    bus.onHassUpdate(hass);

    expect(invalidations).toBe(0);
  });
});

describe("RefreshBus local mutations (S4)", () => {
  it("notifyLocalMutation invalidates immediately", () => {
    const bus = new RefreshBus();
    let invalidations = 0;
    bus.onInvalidate(() => {
      invalidations += 1;
    });

    bus.notifyLocalMutation();

    expect(invalidations).toBe(1);
  });
});

describe("RefreshBus.detach", () => {
  it("stops admin event forwarding and clears entity-tick memory", async () => {
    vi.useFakeTimers();
    try {
      const hass = new FakeHass();
      hass.user.is_admin = true;
      const bus = new RefreshBus();
      let invalidations = 0;
      bus.onInvalidate(() => {
        invalidations += 1;
      });
      await bus.attachAdminEvents(hass);

      bus.detach();
      hass.fireEvent("miniflux_new_entries", {});
      await vi.advanceTimersByTimeAsync(2000);

      expect(invalidations).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
