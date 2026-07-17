// Wire shapes returned by the miniflux.* services this subtree calls.
// Field names match custom_components/miniflux/services.py's *_to_dict
// output exactly (snake_case, as HA services return it) -- these are DTOs,
// not view models; cards read them directly.

export interface FeedDto {
  id: number;
  title: string;
  site_url: string;
  feed_url: string;
  category_id: number | null;
  category_title: string | null;
  checked_at: string | null;
  parsing_error_count: number;
  parsing_error_message: string;
  disabled: boolean;
  /** G2: joined from the last poll snapshot; 0 when the feed is absent from it. */
  unread: number;
}

export interface CategoryDto {
  id: number;
  title: string;
  /** G1: null when the poll snapshot has no data for this category yet
   * (including every empty category -- the snapshot cannot represent those). */
  feed_count: number | null;
  unread: number | null;
}

export interface DiscoverCandidateDto {
  url: string;
  title: string;
  type: string;
}

export type EntryStatus = "unread" | "read" | "removed";

export interface CategoryRef {
  /** Category id or exact title -- resolved server-side (filters.py). */
  category: number | string;
}

export interface FeedRef {
  /** Feed id or exact title -- resolved server-side (filters.py). */
  feed: number | string;
}
