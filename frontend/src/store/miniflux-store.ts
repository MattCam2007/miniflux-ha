// F-U6/F-U7 composition root: the cache + refresh bus every card shares.
// One instance per card (cards don't share a store across custom-element
// instances, matching how HA mounts each card independently), but two
// mounted views of the *same* card still converge within one frame of a
// mutation because both call notifyLocalMutation()/see the same bus event.

import type { Hass } from "../api/hass-types";
import { cacheKey, keyMatchesEntryAndService } from "./cache-key";
import { QueryCache, TTL_LONG_MS } from "./query-cache";
import { RefreshBus } from "./refresh-bus";

export const SERVICE_GET_FEEDS = "get_feeds";
export const SERVICE_GET_CATEGORIES = "get_categories";

export class MinifluxStore {
  readonly cache = new QueryCache();
  readonly bus = new RefreshBus();

  constructor() {
    // Bus-driven invalidation (admin events / entity ticks) doesn't carry
    // a specific config entry to scope to in general, but Phase 1 only
    // ever has the one; a full clear here is simplest and correct (D-3:
    // no S7 multi-instance matrix to worry about for this path). Targeted,
    // per-entry invalidation is what invalidateFeeds/invalidateCategories
    // below exist for (S4's actual requirement).
    this.bus.onInvalidate(() => this.cache.clear());
  }

  /** Cache-or-fetch for a list query. `fetcher` is only invoked on a miss
   * (or expiry) -- callers pass a closure over the already-resolved
   * MinifluxApi call. */
  async query<T>(
    configEntryId: string,
    service: string,
    params: Record<string, unknown>,
    ttlMs: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const key = cacheKey(configEntryId, service, params);
    const cached = this.cache.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await fetcher();
    this.cache.set(key, value, ttlMs);
    return value;
  }

  keysFor(configEntryId: string, service: string): string[] {
    return this.cache.keysWhere((key) => keyMatchesEntryAndService(key, configEntryId, service));
  }

  /** Targeted invalidation (S4): only this entry's get_feeds queries, no
   * unrelated key touched -- unlike the bus path above, which clears
   * everything (fine for Phase 1's single-instance-only UI). */
  invalidateFeeds(configEntryId: string): void {
    this.cache.invalidateWhere((key) =>
      keyMatchesEntryAndService(key, configEntryId, SERVICE_GET_FEEDS),
    );
  }

  invalidateCategories(configEntryId: string): void {
    this.cache.invalidateWhere((key) =>
      keyMatchesEntryAndService(key, configEntryId, SERVICE_GET_CATEGORIES),
    );
  }

  /** Feed <-> category cascades (e.g. moving a feed, deleting a category)
   * touch both list shapes at once. */
  invalidateFeedsAndCategories(configEntryId: string): void {
    this.invalidateFeeds(configEntryId);
    this.invalidateCategories(configEntryId);
  }

  /** A card's successful mutation calls this after invalidating its own
   * keys above, so every other mounted view of the same card converges
   * within the same frame (S4) instead of waiting for the next poll tick. */
  notifyLocalMutation(): void {
    this.bus.notifyLocalMutation();
  }

  async attach(hass: Hass): Promise<void> {
    await this.bus.attachAdminEvents(hass);
  }

  onHassUpdate(hass: Hass): void {
    this.bus.onHassUpdate(hass);
  }

  detach(): void {
    this.bus.detach();
  }
}

export { TTL_LONG_MS };
