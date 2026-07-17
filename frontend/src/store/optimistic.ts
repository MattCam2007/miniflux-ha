// F-U8 (DC5, S4): synchronous cache patch + rollback. Baked decision
// (00-START-HERE.md step 10): used by C3's rename and enable/disable --
// both simple single-field toggles well-suited to instant feedback. Feed/
// category create/delete/move stay non-optimistic (server assigns ids and
// side effects); those show a pending state and re-query on success
// instead of calling this.

import type { QueryCache } from "./query-cache";

export interface OptimisticOutcome {
  ok: boolean;
  error?: unknown;
}

/** Patches every cache entry in `keys` synchronously via `patch`, runs
 * `mutate`, and on failure reverts every patched key to its exact prior
 * value (or drops it, if it wasn't cached to begin with) before returning
 * the failure so the caller can surface a toast with the backend's
 * verbatim message. Patches all matching keys up front (not just one) so
 * two mounted views of the same list both reflect the optimistic value
 * within the same frame (S4). */
export async function applyOptimisticPatch<T>(
  cache: QueryCache,
  keys: readonly string[],
  patch: (current: T) => T,
  ttlMs: number,
  mutate: () => Promise<void>,
): Promise<OptimisticOutcome> {
  const priorValues = new Map<string, T | undefined>();
  for (const key of keys) {
    const current = cache.get<T>(key);
    priorValues.set(key, current);
    if (current !== undefined) cache.set(key, patch(current), ttlMs);
  }

  try {
    await mutate();
    return { ok: true };
  } catch (error) {
    for (const [key, prior] of priorValues) {
      if (prior === undefined) cache.invalidate(key);
      else cache.set(key, prior, ttlMs);
    }
    return { ok: false, error };
  }
}
