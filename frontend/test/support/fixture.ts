import type { LitElement } from "lit";

import type { FakeHass } from "./fake-hass";

interface FixtureOptions<C> {
  hass?: FakeHass;
  config?: C;
}

/** Attaches `tag` to a detached document, sets `.hass`/`.config` if given,
 * and awaits Lit's `updateComplete` -- the standard mount helper every
 * component-ring test uses (00-method-and-conventions.md §2). Elements
 * mounted this way are tracked and removed by `cleanupFixtures()`; call
 * that from an `afterEach` so tests never leak elements into each other. */
const mounted: HTMLElement[] = [];

export async function fixture<E extends LitElement, C = unknown>(
  tag: string,
  options: FixtureOptions<C> = {},
): Promise<E> {
  const el = document.createElement(tag) as unknown as E & {
    hass?: FakeHass;
    setConfig?: (config: C) => void;
  };

  if (options.hass) {
    el.hass = options.hass;
  }
  if (options.config && typeof el.setConfig === "function") {
    el.setConfig(options.config);
  }

  document.body.appendChild(el as unknown as HTMLElement);
  mounted.push(el as unknown as HTMLElement);

  await (el as unknown as LitElement).updateComplete;
  return el as unknown as E;
}

export function cleanupFixtures(): void {
  for (const el of mounted.splice(0)) {
    el.remove();
  }
}

/** Shadow-DOM query helpers -- assertions read rendered shadow DOM, never
 * light-DOM internals, matching how a real card actually renders. */
export function shadowQuery<T extends Element = Element>(
  el: Element,
  selector: string,
): T | null {
  return (el.shadowRoot?.querySelector(selector) as T | null) ?? null;
}

export function shadowQueryAll<T extends Element = Element>(
  el: Element,
  selector: string,
): T[] {
  return Array.from(el.shadowRoot?.querySelectorAll(selector) ?? []) as T[];
}
