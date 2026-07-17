// F-U6 (DC3): TTL-based query cache. Feeds/categories get a long TTL
// (they change slowly, and G1/G2's counts are only "as of last poll"
// anyway, so refetching faster than a poll buys nothing); a short-TTL tier
// exists for Phase 2's entry queries, unused by anything in Phase 1.

export const TTL_LONG_MS = 5 * 60 * 1000;
export const TTL_SHORT_MS = 15 * 1000;

interface CacheRecord<T> {
  value: T;
  expiresAt: number;
}

export class QueryCache {
  private readonly records = new Map<string, CacheRecord<unknown>>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  get<T>(key: string): T | undefined {
    const record = this.records.get(key);
    if (!record) return undefined;
    if (this.now() >= record.expiresAt) {
      this.records.delete(key);
      return undefined;
    }
    return record.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.records.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  invalidate(key: string): void {
    this.records.delete(key);
  }

  invalidateWhere(predicate: (key: string) => boolean): void {
    for (const key of this.records.keys()) {
      if (predicate(key)) this.records.delete(key);
    }
  }

  /** Keys currently satisfying `predicate` -- live (non-expired) entries
   * only, since an expired one isn't meaningfully "cached" (F-U8 uses this
   * to find which cached queries to optimistically patch). */
  keysWhere(predicate: (key: string) => boolean): string[] {
    const now = this.now();
    const keys: string[] = [];
    for (const [key, record] of this.records) {
      if (now < record.expiresAt && predicate(key)) keys.push(key);
    }
    return keys;
  }

  clear(): void {
    this.records.clear();
  }
}
