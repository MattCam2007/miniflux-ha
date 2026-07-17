import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../src/atoms/mf-toast-host";
import type { MfToastHost } from "../../src/atoms/mf-toast-host";
import { cleanupFixtures, fixture, shadowQuery, shadowQueryAll } from "../support/fixture";

afterEach(() => {
  cleanupFixtures();
});

describe("<mf-toast-host>", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a toast with its message", async () => {
    const el = await fixture<MfToastHost>("mf-toast-host");
    el.show("Feed deleted");
    await el.updateComplete;

    expect(shadowQuery(el, ".toast")?.textContent).toContain("Feed deleted");
  });

  it("clicking Undo fires the callback within the window and dismisses the toast", async () => {
    const el = await fixture<MfToastHost>("mf-toast-host");
    const undo = vi.fn();
    el.show("Feed deleted", { undo, timeoutMs: 5000 });
    await el.updateComplete;

    await vi.advanceTimersByTimeAsync(1000);
    shadowQuery<HTMLButtonElement>(el, "button")?.click();
    await el.updateComplete;

    expect(undo).toHaveBeenCalledTimes(1);
    expect(shadowQuery(el, ".toast")).toBeNull();
  });

  it("auto-dismisses after the timeout without calling undo", async () => {
    const el = await fixture<MfToastHost>("mf-toast-host");
    const undo = vi.fn();
    el.show("Feed deleted", { undo, timeoutMs: 5000 });
    await el.updateComplete;

    await vi.advanceTimersByTimeAsync(5000);
    await el.updateComplete;

    expect(undo).not.toHaveBeenCalled();
    expect(shadowQuery(el, ".toast")).toBeNull();
  });

  it("a toast with no undo callback renders no Undo button", async () => {
    const el = await fixture<MfToastHost>("mf-toast-host");
    el.show("Saved");
    await el.updateComplete;

    expect(shadowQuery(el, "button")).toBeNull();
  });

  it("clicking Undo after the timeout already fired is impossible -- the toast is gone", async () => {
    const el = await fixture<MfToastHost>("mf-toast-host");
    const undo = vi.fn();
    el.show("Feed deleted", { undo, timeoutMs: 1000 });
    await el.updateComplete;

    await vi.advanceTimersByTimeAsync(1000);
    await el.updateComplete;

    expect(shadowQuery(el, "button")).toBeNull();
    expect(undo).not.toHaveBeenCalled();
  });

  it("multiple toasts stack and dismiss independently", async () => {
    const el = await fixture<MfToastHost>("mf-toast-host");
    el.show("First", { timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(500);
    el.show("Second", { timeoutMs: 1000 });
    await el.updateComplete;

    expect(shadowQueryAll(el, ".toast")).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(500); // First's total 1000ms elapsed
    await el.updateComplete;
    expect(shadowQueryAll(el, ".toast")).toHaveLength(1);
    expect(shadowQuery(el, ".toast")?.textContent).toContain("Second");
  });
});
