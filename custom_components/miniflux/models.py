"""Normalized data models shared by every internal consumer (architecture §3.2).

Framework-free: no ``homeassistant`` import. All internal consumers (the API
client's return values, the coordinator's snapshot, the webhook re-emitter)
speak these shapes, never raw Miniflux JSON — see ``normalize.py``.

Frozen dataclasses: top-level fields cannot be reassigned. Collection fields
(``tags``, ``feeds``, ``error_feeds``) use tuples rather than lists so
instances are genuinely immutable, not just field-reassignment-proof.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime

from .const import TITLE_TRUNCATE


@dataclass(frozen=True, slots=True)
class Entry:
    """A Miniflux entry. ``content`` is present only when explicitly requested (D2)."""

    id: int
    feed_id: int
    feed_title: str
    category_id: int | None
    category_title: str | None
    title: str
    url: str
    author: str
    published_at: datetime
    changed_at: datetime
    status: str
    starred: bool
    reading_time: int
    tags: tuple[str, ...] = ()
    content: str | None = None


@dataclass(frozen=True, slots=True)
class EntryCompact:
    """The event-safe projection of an Entry: bounded size, no content (D2)."""

    id: int
    feed_id: int
    title: str
    url: str
    published_at: datetime
    author: str

    @classmethod
    def from_entry(cls, entry: Entry, *, title_cap: int = TITLE_TRUNCATE) -> EntryCompact:
        title = entry.title
        if len(title) > title_cap:
            title = title[:title_cap]
        return cls(
            id=entry.id,
            feed_id=entry.feed_id,
            title=title,
            url=entry.url,
            published_at=entry.published_at,
            author=entry.author,
        )


@dataclass(frozen=True, slots=True)
class Feed:
    """A Miniflux feed, including its health fields (architecture §3.2)."""

    id: int
    title: str
    site_url: str
    feed_url: str
    category_id: int | None
    category_title: str | None
    checked_at: datetime | None
    parsing_error_count: int
    parsing_error_message: str
    disabled: bool


@dataclass(frozen=True, slots=True)
class CategoryUnread:
    """One row of the unread-by-category rollup (architecture §3.2)."""

    id: int
    title: str
    unread: int


@dataclass(frozen=True, slots=True)
class Snapshot:
    """The coordinator's canonical poll result (architecture §3.2, §2.3)."""

    fetched_at: datetime
    feeds: tuple[Feed, ...]
    unread_total: int
    unread_by_feed: Mapping[int, int]
    unread_by_category: tuple[CategoryUnread, ...]
    starred_total: int
    error_feeds: tuple[Feed, ...] = field(default=())

    @property
    def error_feed_ids(self) -> tuple[int, ...]:
        return tuple(f.id for f in self.error_feeds)
