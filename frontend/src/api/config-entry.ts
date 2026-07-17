// F-U3 (DC6): resolve which Miniflux config entry a card targets.
//
// Real-HA constraint (found on the first live install): the browser's
// `hass.entities` is the *display* entity registry
// (home-assistant/frontend's EntityRegistryDisplayEntry). Those entries
// carry `platform` but NOT `config_entry_id` -- the owning entry id lives
// only in the full registry, reachable via an admin-only websocket call. So
// the frontend can detect that Miniflux entities exist (via `platform`,
// delivered to every user including non-admins) but usually cannot read the
// config entry id here.
//
// It doesn't need to: the backend targeting convention
// (services.py::_resolve_entry) auto-resolves the single configured instance
// whenever config_entry_id is omitted, and Phase 1 supports exactly one
// instance (D-3). So when no real id is resolvable we target the instance
// with DEFAULT_INSTANCE_KEY -- a stable per-instance cache-key namespace that
// toBackendConfigEntryId() strips back to `undefined` before the call, letting
// the backend do the resolving. When a real config_entry_id *is* available
// (an explicit card option, or a host/test that exposes it) it is used as-is
// and sent through, preserving the multi-instance semantics below.

import type { Hass } from "./hass-types";

export const MINIFLUX_PLATFORM = "miniflux";

/** Cache-key namespace for the auto-resolved single instance. Never sent to
 * the backend (see toBackendConfigEntryId) -- it's an internal token, not a
 * real config entry id. */
export const DEFAULT_INSTANCE_KEY = "__miniflux_default__";

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

// Registry scans are pure functions of `hass.entities`; cache by object
// identity so repeated calls within the same hass tick don't re-scan every
// entity every time (F-U3: "caches the registry lookup"). A new poll gives
// HA frontend a new `entities` object, which naturally invalidates this.
const idsCache = new WeakMap<Hass["entities"], string[]>();

/** Distinct owning config_entry_ids among Miniflux-platform entities, in
 * first-seen order. In real HA the display registry exposes no
 * config_entry_id, so this falls back to a single DEFAULT_INSTANCE_KEY
 * whenever any Miniflux entity is present -- enough to know the integration
 * is set up, without a real id the browser can't see. */
export function listConfigEntryIds(hass: Hass): string[] {
  const cached = idsCache.get(hass.entities);
  if (cached) return cached;

  const seen = new Set<string>();
  const ids: string[] = [];
  let anyMiniflux = false;
  for (const entity of Object.values(hass.entities)) {
    if (entity.platform !== MINIFLUX_PLATFORM) continue;
    anyMiniflux = true;
    const entryId = entity.config_entry_id;
    if (entryId && !seen.has(entryId)) {
      seen.add(entryId);
      ids.push(entryId);
    }
  }

  const result = ids.length > 0 ? ids : anyMiniflux ? [DEFAULT_INSTANCE_KEY] : [];
  idsCache.set(hass.entities, result);
  return result;
}

/** Resolves the config-entry token every MinifluxApi call targets. An
 * explicit `requested` id always wins and is passed straight through -- the
 * backend validates it (the frontend can't, having no real id list in the
 * common case). Otherwise: exactly one configured instance auto-resolves;
 * zero throws NoInstanceConfiguredError; more than one distinct real id (only
 * possible when the host actually exposes ids) throws AmbiguousInstanceError,
 * never silently picking one. */
export function resolveConfigEntryId(hass: Hass, requested?: string): string {
  if (requested !== undefined) return requested;

  const ids = listConfigEntryIds(hass);
  if (ids.length === 1) return ids[0];
  if (ids.length === 0) throw new NoInstanceConfiguredError();
  throw new AmbiguousInstanceError(ids);
}

/** Maps a resolved token to the value actually sent to HA: the default
 * sentinel becomes `undefined` (omit it -> the backend auto-resolves the
 * single configured instance); any real config entry id is sent unchanged. */
export function toBackendConfigEntryId(resolved: string): string | undefined {
  return resolved === DEFAULT_INSTANCE_KEY ? undefined : resolved;
}
