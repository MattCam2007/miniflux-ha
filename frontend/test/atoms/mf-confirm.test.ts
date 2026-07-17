import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../src/atoms/mf-confirm";
import type { MfConfirm } from "../../src/atoms/mf-confirm";
import { cleanupFixtures, fixture, shadowQuery } from "../support/fixture";

afterEach(() => {
  cleanupFixtures();
});

async function openPanel(el: MfConfirm): Promise<void> {
  shadowQuery<HTMLButtonElement>(el, "button.trigger")?.click();
  await el.updateComplete;
}

describe("<mf-confirm> default (no hold)", () => {
  it("shows only the trigger button initially", async () => {
    const el = await fixture<MfConfirm>("mf-confirm");
    expect(shadowQuery(el, "button.trigger")).not.toBeNull();
    expect(shadowQuery(el, ".panel")).toBeNull();
  });

  it("renders the real blast-radius message from the prop", async () => {
    const el = await fixture<MfConfirm>("mf-confirm");
    el.message = "Delete Ars Technica and its 1,204 entries?";
    await openPanel(el);

    expect(shadowQuery(el, ".message")?.textContent?.trim()).toBe(
      "Delete Ars Technica and its 1,204 entries?",
    );
  });

  it("fires mf-confirm only after the confirm click, never on the first (trigger) click", async () => {
    const el = await fixture<MfConfirm>("mf-confirm");
    const onConfirm = vi.fn();
    el.addEventListener("mf-confirm", onConfirm);

    shadowQuery<HTMLButtonElement>(el, "button.trigger")?.click();
    await el.updateComplete;
    expect(onConfirm).not.toHaveBeenCalled();

    shadowQuery<HTMLButtonElement>(el, "button.confirm")?.click();
    await el.updateComplete;

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancel is a no-op -- no mf-confirm event, and it returns to the trigger state", async () => {
    const el = await fixture<MfConfirm>("mf-confirm");
    const onConfirm = vi.fn();
    el.addEventListener("mf-confirm", onConfirm);

    await openPanel(el);
    shadowQuery<HTMLButtonElement>(el, "button.cancel")?.click();
    await el.updateComplete;

    expect(onConfirm).not.toHaveBeenCalled();
    expect(shadowQuery(el, "button.trigger")).not.toBeNull();
  });

  it("dispatches mf-cancel on cancel, for callers that want to react to it", async () => {
    const el = await fixture<MfConfirm>("mf-confirm");
    const onCancel = vi.fn();
    el.addEventListener("mf-cancel", onCancel);

    await openPanel(el);
    shadowQuery<HTMLButtonElement>(el, "button.cancel")?.click();
    await el.updateComplete;

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("a disabled trigger never opens the confirm panel", async () => {
    const el = await fixture<MfConfirm>("mf-confirm");
    el.disabled = true;
    await el.updateComplete;

    shadowQuery<HTMLButtonElement>(el, "button.trigger")?.click();
    await el.updateComplete;

    expect(shadowQuery(el, ".panel")).toBeNull();
  });
});

describe("<mf-confirm require-hold> (D-4 category delete)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a plain click on the hold button does not confirm", async () => {
    const el = await fixture<MfConfirm>("mf-confirm");
    el.requireHold = true;
    await openPanel(el);
    const onConfirm = vi.fn();
    el.addEventListener("mf-confirm", onConfirm);

    shadowQuery<HTMLButtonElement>(el, "button.confirm")?.click();

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms after a sustained press of the full hold duration", async () => {
    const el = await fixture<MfConfirm>("mf-confirm");
    el.requireHold = true;
    el.holdMs = 900;
    await openPanel(el);
    const onConfirm = vi.fn();
    el.addEventListener("mf-confirm", onConfirm);

    const button = shadowQuery<HTMLButtonElement>(el, "button.confirm")!;
    button.dispatchEvent(new Event("pointerdown"));

    await vi.advanceTimersByTimeAsync(899);
    expect(onConfirm).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("releasing early cancels the hold -- no confirmation, and the panel stays open", async () => {
    const el = await fixture<MfConfirm>("mf-confirm");
    el.requireHold = true;
    el.holdMs = 900;
    await openPanel(el);
    const onConfirm = vi.fn();
    el.addEventListener("mf-confirm", onConfirm);

    const button = shadowQuery<HTMLButtonElement>(el, "button.confirm")!;
    button.dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(400);
    button.dispatchEvent(new Event("pointerup"));
    await vi.advanceTimersByTimeAsync(900);

    expect(onConfirm).not.toHaveBeenCalled();
    await el.updateComplete;
    expect(shadowQuery(el, ".panel")).not.toBeNull();
  });

  it("a pointerleave mid-hold also cancels it (dragging off the button)", async () => {
    const el = await fixture<MfConfirm>("mf-confirm");
    el.requireHold = true;
    el.holdMs = 900;
    await openPanel(el);
    const onConfirm = vi.fn();
    el.addEventListener("mf-confirm", onConfirm);

    const button = shadowQuery<HTMLButtonElement>(el, "button.confirm")!;
    button.dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(400);
    button.dispatchEvent(new Event("pointerleave"));
    await vi.advanceTimersByTimeAsync(900);

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
