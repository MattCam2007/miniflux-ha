import { LitElement, html } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FakeHass } from "./support/fake-hass";
import { cleanupFixtures, fixture, shadowQuery } from "./support/fixture";

class HarnessProbeElement extends LitElement {
  static properties = { hass: {} };
  hass?: FakeHass;

  protected render() {
    const count = this.hass ? Object.keys(this.hass.states).length : 0;
    return html`<span class="count">${count}</span>`;
  }
}
customElements.define("harness-probe-element", HarnessProbeElement);

afterEach(() => {
  cleanupFixtures();
});

describe("FakeHass + fixture() harness self-test (F-U2)", () => {
  it("mounts a trivial element and it reads hass.states", async () => {
    const hass = new FakeHass();
    hass.setState("sensor.miniflux_unread_entries", "5");

    const el = await fixture<HarnessProbeElement>("harness-probe-element", { hass });

    expect(shadowQuery(el, ".count")?.textContent).toBe("1");
  });

  it("a scripted callService resolves with the scripted response", async () => {
    const hass = new FakeHass();
    hass.respondTo("miniflux", "get_feeds", () => ({ feeds: [{ id: 1 }] }));

    const result = await hass.callService(
      "miniflux",
      "get_feeds",
      {},
      undefined,
      true,
      true,
    );

    expect(result.response).toEqual({ feeds: [{ id: 1 }] });
    expect(hass.calls).toEqual([
      {
        domain: "miniflux",
        service: "get_feeds",
        data: {},
        target: undefined,
        returnResponse: true,
      },
    ]);
  });

  it("an unscripted callService rejects loudly instead of hanging", async () => {
    const hass = new FakeHass();
    await expect(hass.callService("miniflux", "nope", {})).rejects.toThrow(
      /No handler scripted/,
    );
  });

  it("fake timers advance a debounce without a real wait", async () => {
    vi.useFakeTimers();
    try {
      let fired = 0;
      const debounced = () => {
        fired += 1;
      };
      let timer: ReturnType<typeof setTimeout> | undefined;
      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(debounced, 2000);
      };

      schedule();
      schedule();
      schedule();
      expect(fired).toBe(0);

      vi.advanceTimersByTime(1999);
      expect(fired).toBe(0);

      vi.advanceTimersByTime(1);
      expect(fired).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("non-admin users never receive subscribeEvents callbacks (G4)", async () => {
    const hass = new FakeHass();
    hass.user.is_admin = false;
    let received = 0;
    await hass.connection.subscribeEvents(() => {
      received += 1;
    }, "miniflux_new_entries");

    hass.fireEvent("miniflux_new_entries", {});

    expect(received).toBe(0);
  });

  it("admin users receive subscribeEvents callbacks for the subscribed type", async () => {
    const hass = new FakeHass();
    hass.user.is_admin = true;
    let received = 0;
    await hass.connection.subscribeEvents(() => {
      received += 1;
    }, "miniflux_new_entries");

    hass.fireEvent("miniflux_new_entries", {});
    hass.fireEvent("miniflux_feed_error", {});

    expect(received).toBe(1);
  });

  it("subscribeEntities fires on a simulated poll tick", () => {
    const hass = new FakeHass();
    const seen: number[] = [];
    hass.connection.subscribeEntities((states) => {
      seen.push(Object.keys(states).length);
    });

    hass.setState("sensor.miniflux_unread_entries", "3");

    expect(seen).toEqual([1]);
  });
});
