// Pure view-model helpers for C3 (feed manager card), kept separate from
// the card's rendering/orchestration code so they hold the 100% runtime
// floor independent of the card's own 90% view-code floor.

import type { FeedDto } from "../api/types";

export const UNCATEGORIZED_KEY = "__uncategorized__";
export const UNCATEGORIZED_TITLE = "Uncategorized";

export interface FeedGroup {
  key: string | number;
  title: string;
  feeds: FeedDto[];
}

/** One letter/monogram avatar (D-6/G6 deferral: no real favicons in Phase 1). */
export function monogram(title: string): string {
  const trimmed = title.trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
}

export function groupFeedsByCategory(feeds: FeedDto[]): FeedGroup[] {
  const groups = new Map<string | number, FeedGroup>();

  for (const feed of feeds) {
    const key = feed.category_id ?? UNCATEGORIZED_KEY;
    const title = feed.category_id === null ? UNCATEGORIZED_TITLE : (feed.category_title ?? "");
    const existing = groups.get(key);
    if (existing) {
      existing.feeds.push(feed);
    } else {
      groups.set(key, { key, title, feeds: [feed] });
    }
  }

  const sorted = [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
  const uncategorizedIndex = sorted.findIndex((g) => g.key === UNCATEGORIZED_KEY);
  if (uncategorizedIndex !== -1) {
    const [uncategorized] = sorted.splice(uncategorizedIndex, 1);
    sorted.push(uncategorized);
  }
  return sorted;
}

/** Human age since `checkedAt` relative to `now` -- coarse buckets are
 * plenty for a list row (exact timestamps live in the edit sheet/tooltip). */
export function formatCheckedAge(checkedAt: string | null, now: Date): string {
  if (!checkedAt) return "Never checked";

  const checkedDate = new Date(checkedAt);
  const diffMs = now.getTime() - checkedDate.getTime();
  if (diffMs < 0) return "Just now";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Only the fields that actually differ from `original` -- update_feed
 * sends dirty fields only (C3-U3). */
export function diffFeedFields(
  original: FeedDto,
  edited: {
    title: string;
    category: number | string | undefined;
    feed_url: string;
    disabled: boolean;
    crawler: boolean;
  },
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (edited.title !== original.title) patch.title = edited.title;
  if (edited.category !== undefined && edited.category !== original.category_id) {
    patch.category = edited.category;
  }
  if (edited.feed_url !== original.feed_url) patch.feed_url = edited.feed_url;
  if (edited.disabled !== original.disabled) patch.disabled = edited.disabled;
  // crawler has no readable "current" value from FeedDto (Miniflux doesn't
  // return it on get_feeds), so it's always sent -- harmless (idempotent)
  // and avoids the field silently never reaching the backend.
  patch.crawler = edited.crawler;
  return patch;
}
