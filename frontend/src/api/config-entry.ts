// F-U3 (DC6): resolve Miniflux config entries from the entity registry --
// every entity this integration creates carries `platform: "miniflux"` and
// its owning `config_entry_id` (architecture: 4 entities per entry). D-3
// (single instance only) means the common case is exactly one id; the
// multi-entry branch exists as a typed error, not a picker UI (no card in
// Phase 1 ever shows an instance picker -- F-U13 hides it unconditionally).

import type { Hass } from "./hass-types";

export const MINIFLUX_PLATFORM = "miniflux";

export class NoInstanceConfiguredError extends Error {
  constructor() {
    super("No Miniflux instance is configured.");
    this.name = "NoInstanceConfiguredError";
  }
}

export class AmbiguousInstanceError extends Error {
  constructor(readonly configEntryIds: readonly string[]) {
    super(
      `Multiple Miniflux instances are configured (${configEntryIds.join(", ")}); ` +
        "specify config_entry_id.",
    );
    this.name = "AmbiguousInstanceError";
  }
}

export class UnknownInstanceError extends Error {
  constructor(readonly configEntryId: string) {
    super(`Unknown config_entry_id: ${configEntryId}`);
    this.name = "UnknownInstanceError";
  }
}

// Registry scans are pure functions of `hass.entities`; cache by object
// identity so repeated calls within the same hass tick don't re-scan every
// entity every time (F-U3: "caches the registry lookup"). A new poll gives
// HA frontend a new `entities` object, which naturally invalidates this.
const idsCache = new WeakMap<Hass["entities"], string[]>();

/** All distinct config_entry_ids with at least one miniflux-platform entity,
 * in first-seen order. */
export function listConfigEntryIds(hass: Hass): string[] {
  const cached = idsCache.get(hass.entities);
  if (cached) return cached;

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entity of Object.values(hass.entities)) {
    if (entity.platform !== MINIFLUX_PLATFORM || !entity.config_entry_id) continue;
    if (!seen.has(entity.config_entry_id)) {
      seen.add(entity.config_entry_id);
      ids.push(entity.config_entry_id);
    }
  }
  idsCache.set(hass.entities, ids);
  return ids;
}

/** Resolves the config_entry_id every MinifluxApi call targets.
 * `requested` (explicit config_entry_id) always wins when given, and must
 * name a real, currently-registered instance. Otherwise: exactly one
 * configured instance auto-resolves; zero throws NoInstanceConfiguredError;
 * more than one throws AmbiguousInstanceError (never silently picks one). */
export function resolveConfigEntryId(hass: Hass, requested?: string): string {
  const ids = listConfigEntryIds(hass);

  if (requested !== undefined) {
    if (!ids.includes(requested)) throw new UnknownInstanceError(requested);
    return requested;
  }
  if (ids.length === 1) return ids[0];
  if (ids.length === 0) throw new NoInstanceConfiguredError();
  throw new AmbiguousInstanceError(ids);
}
