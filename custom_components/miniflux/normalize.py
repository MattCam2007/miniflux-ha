"""Raw Miniflux JSON -> models (architecture §3.2).

Alongside api.py, the only module that knows Miniflux's JSON field names
(seam corollary, plans/00-overview.md §4). If the R1 contract-pinning pass
finds a field-name mismatch, this module is where it gets fixed.
"""

from __future__ import annotations

from . import timeutil
from .models import Category, Entry, Feed


def entry_from_json(data: dict) -> Entry:
    feed = data.get("feed") or {}
    category = feed.get("category") or {}
    # Empty string and missing key both mean "content not requested" (D2).
    content = data.get("content") or None
    return Entry(
        id=data["id"],
        feed_id=data["feed_id"],
        feed_title=feed.get("title", ""),
        category_id=category.get("id"),
        category_title=category.get("title"),
        title=data["title"],
        url=data["url"],
        author=data.get("author", ""),
        published_at=timeutil.parse_ts(data["published_at"]),
        changed_at=timeutil.parse_ts(data["changed_at"]),
        status=data["status"],
        starred=data.get("starred", False),
        reading_time=data.get("reading_time", 0),
        tags=tuple(data.get("tags", [])),
        content=content,
    )


def feed_from_json(data: dict) -> Feed:
    category = data.get("category") or {}
    checked_at_raw = data.get("checked_at")
    return Feed(
        id=data["id"],
        title=data["title"],
        site_url=data.get("site_url", ""),
        feed_url=data.get("feed_url", ""),
        category_id=category.get("id"),
        category_title=category.get("title"),
        checked_at=timeutil.parse_ts(checked_at_raw) if checked_at_raw else None,
        parsing_error_count=data.get("parsing_error_count", 0),
        parsing_error_message=data.get("parsing_error_message", ""),
        disabled=data.get("disabled", False),
    )


def category_from_json(data: dict) -> Category:
    """feed_count/unread are always None here (G1, D-7) -- this call carries
    no snapshot to join against; the service layer fills them in."""
    return Category(id=data["id"], title=data["title"])
