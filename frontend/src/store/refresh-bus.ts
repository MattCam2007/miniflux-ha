// F-U7 (DC4, G4, S2, S9): three invalidation inputs.
//  (a) admin bus events on the 4 miniflux_* types, debounced >=2s (S2) --
//      requires admin (G4); a non-admin subscribeEvents rejects (verified
//      against HA core), so this path degrades to a permanent no-op for
//      that session rather than retrying.
//  (b) the card's own `hass` setter re-invoking onHassUpdate() on every
//      entity change -- the universal, non-admin-safe poll-tick signal
//      (S9). This is *not* a websocket subscription (see fake-hass.ts's
//      module comment for why); it piggybacks on the update HA already
//      delivers to every mounted card regardless of admin state.
//  (c) local mutations (S4): a card's own successful write invalidates
//      immediately, no debounce -- it's a known-fresh change, not a signal
//      to coalesce.

import type { Hass } from "../api/hass-types";

export const ADMIN_EVENT_TYPES = [
  "miniflux_new_entries",
  "miniflux_entry_saved",
  "miniflux_feed_error",
  "miniflux_feed_recovered",
] as const;

export const TRACKED_ENTITY_IDS = [
  "sensor.miniflux_unread_entries",
  "sensor.miniflux_starred_entries",
  "sensor.miniflux_feeds_with_errors",
  "binary_sensor.miniflux_reachable",
] as const;

export const ADMIN_DEBOUNCE_MS = 2000;

export type InvalidationListener = () => void;

export class RefreshBus {
  private readonly listeners = new Set<InvalidationListener>();
  private readonly lastEntityTick = new Map<string, string>();
  private readonly unsubscribes: Array<() => void> = [];
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private adminAttached = false;

  onInvalidate(listener: InvalidationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private scheduleDebouncedNotify(): void {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      this.notify();
    }, ADMIN_DEBOUNCE_MS);
  }

  /** Idempotent; call once per card mount. Subscribes to the 4 admin bus
   * events if possible. A non-admin user's subscribeEvents call rejects
   * (G4) -- caught and swallowed here, since the entity-tick path is the
   * designed fallback, not an error condition. */
  async attachAdminEvents(hass: Hass): Promise<void> {
    if (this.adminAttached) return;
    this.adminAttached = true;
    try {
      for (const eventType of ADMIN_EVENT_TYPES) {
        const unsubscribe = await hass.connection.subscribeEvents(() => {
          this.scheduleDebouncedNotify();
        }, eventType);
        this.unsubscribes.push(unsubscribe);
      }
    } catch {
      // Non-admin, or any other subscribe failure: entity ticks alone (S9).
    }
  }

  detach(): void {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = undefined;
    for (const unsubscribe of this.unsubscribes.splice(0)) unsubscribe();
    this.adminAttached = false;
    this.lastEntityTick.clear();
  }

  /** Call from the card's `hass` setter on every HA update. Invalidates
   * immediately (no debounce) the moment any tracked entity's
   * last_changed moves -- a poll only lands once per scan_interval, so
   * there's no burst here to coalesce, unlike the admin event path. */
  onHassUpdate(hass: Hass): void {
    let ticked = false;
    for (const entityId of TRACKED_ENTITY_IDS) {
      const lastChanged = hass.states[entityId]?.last_changed;
      if (lastChanged === undefined) continue;
      if (this.lastEntityTick.get(entityId) !== lastChanged) {
        this.lastEntityTick.set(entityId, lastChanged);
        ticked = true;
      }
    }
    if (ticked) this.notify();
  }

  /** Local mutation bus (S4): invalidate right now, no debounce. */
  notifyLocalMutation(): void {
    this.notify();
  }
}
