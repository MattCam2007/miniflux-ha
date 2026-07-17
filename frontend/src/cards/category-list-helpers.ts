// Pure view-model helpers for C4 (category manager card).

import type { CategoryDto } from "../api/types";

export type CategorySort = "unread" | "title" | "feeds";

/** null counts (G1: unknown, the snapshot has no data yet) sort last,
 * regardless of direction -- "unknown" is never implicitly treated as 0. */
export function sortCategories(categories: CategoryDto[], sort: CategorySort): CategoryDto[] {
  const withIndex = categories.map((category, index) => ({ category, index }));

  withIndex.sort((a, b) => {
    if (sort === "title") {
      return a.category.title.localeCompare(b.category.title);
    }
    const key = sort === "unread" ? "unread" : "feed_count";
    const aValue = a.category[key];
    const bValue = b.category[key];
    if (aValue === null && bValue === null) return a.index - b.index;
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    if (aValue !== bValue) return bValue - aValue; // descending: most unread/feeds first
    return a.index - b.index; // stable tie-break
  });

  return withIndex.map((w) => w.category);
}
