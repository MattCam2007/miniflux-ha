"""feeds + counters -> Snapshot (architecture §2.3 step 2, §3.2). Pure aggregation.

Driven by `feeds` (the authoritative list from GET /v1/feeds), not by the
counters dict: every feed contributes to its category bucket even when the
counters payload has no entry for it (treated as 0), so a category never
silently vanishes from the rollup just because one feed's count is missing.
Counters referencing a feed id absent from `feeds` (e.g. deleted mid-cycle)
are ignored, since the loop only ever looks counters up by known feed ids.

Categories are derived entirely from feeds' embedded category fields — a
category with zero feeds is therefore invisible here by design (architecture
§3.2): there is nothing to roll up, and nothing here ever queries
/v1/categories directly.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime

from .models import CategoryUnread, Feed, Snapshot

# {"reads": {feed_id: count}, "unreads": {feed_id: count}} -- api.py is
# responsible for converting Miniflux's string-keyed JSON into int keys
# before this module ever sees it.
CountersRaw = Mapping[str, Mapping[int, int]]


def build_snapshot(
    feeds: Sequence[Feed],
    counters: CountersRaw,
    starred_total: int,
    fetched_at: datetime,
) -> Snapshot:
    unreads = counters.get("unreads", {})

    unread_by_feed: dict[int, int] = {}
    unread_total = 0
    category_unread: dict[int, int] = {}
    category_titles: dict[int, str] = {}

    for feed in feeds:
        count = unreads.get(feed.id, 0)
        unread_by_feed[feed.id] = count
        unread_total += count
        if feed.category_id is not None:
            category_unread[feed.category_id] = category_unread.get(feed.category_id, 0) + count
            category_titles[feed.category_id] = feed.category_title or ""

    unread_by_category = tuple(
        CategoryUnread(id=category_id, title=category_titles[category_id], unread=unread)
        for category_id, unread in sorted(category_unread.items())
    )

    error_feeds = tuple(
        sorted((feed for feed in feeds if feed.parsing_error_count > 0), key=lambda f: f.id)
    )

    return Snapshot(
        fetched_at=fetched_at,
        feeds=tuple(feeds),
        unread_total=unread_total,
        unread_by_feed=unread_by_feed,
        unread_by_category=unread_by_category,
        starred_total=starred_total,
        error_feeds=error_feeds,
    )
