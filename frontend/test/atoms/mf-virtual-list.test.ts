import { html } from "lit";
import { afterEach, describe, expect, it } from "vitest";

import "../../src/atoms/mf-virtual-list";
import type { MfVirtualList, VirtualListItem } from "../../src/atoms/mf-virtual-list";
import { cleanupFixtures, fixture, shadowQuery, shadowQueryAll } from "../support/fixture";

interface Row extends VirtualListItem {
  id: number;
  title: string;
}

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({ id: i, title: `Row ${i}` }));
}

async function mountList(rows: Row[], overrides: Partial<MfVirtualList<Row>> = {}) {
  const el = await fixture<MfVirtualList<Row>>("mf-virtual-list");
  el.items = rows;
  el.itemHeight = 48;
  el.height = "520px";
  el.renderItem = (row) => html`<div class="row" data-id=${row.id}>${row.title}</div>`;
  Object.assign(el, overrides);
  await el.updateComplete;
  return el;
}

afterEach(() => {
  cleanupFixtures();
});

describe("<mf-virtual-list>", () => {
  it("5000 rows render a bounded number of DOM nodes, not all of them", async () => {
    const el = await mountList(makeRows(5000));

    const rendered = shadowQueryAll(el, ".row");
    // viewport 520px / 48px row ~= 11 visible + 2*5 buffer = 21
    expect(rendered.length).toBeLessThan(50);
    expect(rendered.length).toBeGreaterThan(0);
  });

  it("scrolling reveals later rows and reclaims earlier ones", async () => {
    const el = await mountList(makeRows(5000));
    const firstIds = shadowQueryAll(el, ".row").map((r) => r.getAttribute("data-id"));
    expect(firstIds).toContain("0");
    expect(firstIds).not.toContain("2000");

    const viewport = shadowQuery<HTMLElement>(el, ".viewport")!;
    Object.defineProperty(viewport, "scrollTop", { value: 2000 * 48, writable: true });
    viewport.dispatchEvent(new Event("scroll"));
    await el.updateComplete;

    const scrolledIds = shadowQueryAll(el, ".row").map((r) => r.getAttribute("data-id"));
    expect(scrolledIds).toContain("2000");
    expect(scrolledIds).not.toContain("0");
  });

  it("the spacer's total height reflects the full item count, not just what's rendered", async () => {
    const el = await mountList(makeRows(5000));
    const spacer = shadowQuery<HTMLElement>(el, ".spacer")!;
    expect(spacer.style.height).toBe(`${5000 * 48}px`);
  });

  it("appending items at the tail does not touch scrollTop (position preserved)", async () => {
    const el = await mountList(makeRows(100));
    const viewport = shadowQuery<HTMLElement>(el, ".viewport")!;
    Object.defineProperty(viewport, "scrollTop", { value: 1000, writable: true });
    viewport.dispatchEvent(new Event("scroll"));
    await el.updateComplete;

    el.items = [...el.items, ...makeRows(50).map((r) => ({ ...r, id: r.id + 100 }))];
    await el.updateComplete;

    expect(viewport.scrollTop).toBe(1000);
  });

  it("a short list (fewer rows than fit the viewport) renders every row", async () => {
    const el = await mountList(makeRows(5));
    expect(shadowQueryAll(el, ".row")).toHaveLength(5);
  });

  it("an empty list renders no rows and does not throw", async () => {
    const el = await mountList([]);
    expect(shadowQueryAll(el, ".row")).toHaveLength(0);
  });

  it("a malformed height config (user YAML typo) degrades to a zero-height window instead of throwing", async () => {
    const el = await mountList(makeRows(100), { height: "not-a-number" });
    expect(() => el.updateComplete).not.toThrow();
    expect(shadowQueryAll(el, ".row").length).toBeLessThanOrEqual(el.bufferRows * 2 + 1);
  });
});
