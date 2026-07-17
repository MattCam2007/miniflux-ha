import { afterEach, describe, expect, it } from "vitest";

import "../../src/atoms/mf-truncation-notice";
import type { MfTruncationNotice } from "../../src/atoms/mf-truncation-notice";
import { cleanupFixtures, fixture, shadowQuery } from "../support/fixture";

afterEach(() => {
  cleanupFixtures();
});

describe("<mf-truncation-notice>", () => {
  it("appears when capped is less than total", async () => {
    const el = await fixture<MfTruncationNotice>("mf-truncation-notice");
    el.capped = 100;
    el.total = 342;
    await el.updateComplete;

    expect(shadowQuery(el, ".notice")?.textContent).toContain("Showing first 100 of 342");
  });

  it("does not appear when capped equals total (nothing was actually cut)", async () => {
    const el = await fixture<MfTruncationNotice>("mf-truncation-notice");
    el.capped = 50;
    el.total = 50;
    await el.updateComplete;

    expect(shadowQuery(el, ".notice")).toBeNull();
  });

  it("does not appear when capped exceeds total (defensive -- shouldn't happen, but never misrenders)", async () => {
    const el = await fixture<MfTruncationNotice>("mf-truncation-notice");
    el.capped = 10;
    el.total = 5;
    await el.updateComplete;

    expect(shadowQuery(el, ".notice")).toBeNull();
  });
});
