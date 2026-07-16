"""Chunk 1.1 — normalized data models (architecture §3.2).

Framework-free: no homeassistant import in this file or in models.py.
"""

from __future__ import annotations

import dataclasses
from datetime import UTC, datetime

import pytest

from custom_components.miniflux.const import TITLE_TRUNCATE
from custom_components.miniflux.models import Entry, EntryCompact, Feed, Snapshot

NOW = datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC)


def _entry(**overrides) -> Entry:
    fields = dict(
        id=1,
        feed_id=10,
        feed_title="Example Feed",
        category_id=100,
        category_title="News",
        title="Example title",
        url="https://example.com/a",
        author="Jane Doe",
        published_at=NOW,
        changed_at=NOW,
        status="unread",
        starred=False,
        reading_time=5,
        tags=("tag1", "tag2"),
    )
    fields.update(overrides)
    return Entry(**fields)


def _feed(**overrides) -> Feed:
    fields = dict(
        id=10,
        title="Example Feed",
        site_url="https://example.com",
        feed_url="https://example.com/feed.xml",
        category_id=100,
        category_title="News",
        checked_at=NOW,
        parsing_error_count=0,
        parsing_error_message="",
        disabled=False,
    )
    fields.update(overrides)
    return Feed(**fields)


class TestEntry:
    def test_construct_with_required_fields(self):
        entry = _entry()
        assert entry.id == 1
        assert entry.feed_id == 10
        assert entry.content is None  # optional, defaults to None (D2)

    def test_construct_with_content(self):
        entry = _entry(content="<p>body</p>")
        assert entry.content == "<p>body</p>"

    def test_is_frozen(self):
        entry = _entry()
        with pytest.raises(dataclasses.FrozenInstanceError):
            entry.title = "changed"


class TestEntryCompact:
    def test_construct_with_required_fields(self):
        compact = EntryCompact(
            id=1, feed_id=10, title="t", url="https://x", published_at=NOW, author="a"
        )
        assert compact.id == 1
        assert compact.title == "t"

    def test_is_frozen(self):
        compact = EntryCompact(
            id=1, feed_id=10, title="t", url="https://x", published_at=NOW, author="a"
        )
        with pytest.raises(dataclasses.FrozenInstanceError):
            compact.title = "changed"

    def test_from_entry_copies_six_fields(self):
        entry = _entry()
        compact = EntryCompact.from_entry(entry)
        assert compact.id == entry.id
        assert compact.feed_id == entry.feed_id
        assert compact.title == entry.title
        assert compact.url == entry.url
        assert compact.published_at == entry.published_at
        assert compact.author == entry.author

    def test_from_entry_short_title_unchanged(self):
        entry = _entry(title="short")
        compact = EntryCompact.from_entry(entry)
        assert compact.title == "short"

    def test_from_entry_title_exactly_at_cap_not_truncated(self):
        title = "x" * TITLE_TRUNCATE
        entry = _entry(title=title)
        compact = EntryCompact.from_entry(entry)
        assert compact.title == title
        assert len(compact.title) == TITLE_TRUNCATE

    def test_from_entry_title_over_cap_truncated(self):
        title = "x" * (TITLE_TRUNCATE + 50)
        entry = _entry(title=title)
        compact = EntryCompact.from_entry(entry)
        assert len(compact.title) == TITLE_TRUNCATE
        assert compact.title == "x" * TITLE_TRUNCATE

    def test_from_entry_respects_custom_title_cap(self):
        entry = _entry(title="hello world")
        compact = EntryCompact.from_entry(entry, title_cap=5)
        assert compact.title == "hello"


class TestFeed:
    def test_construct_with_required_fields(self):
        feed = _feed()
        assert feed.id == 10
        assert feed.parsing_error_count == 0

    def test_construct_with_parsing_error(self):
        feed = _feed(parsing_error_count=3, parsing_error_message="connection refused")
        assert feed.parsing_error_count == 3
        assert feed.parsing_error_message == "connection refused"

    def test_construct_without_category(self):
        feed = _feed(category_id=None, category_title=None)
        assert feed.category_id is None
        assert feed.category_title is None

    def test_is_frozen(self):
        feed = _feed()
        with pytest.raises(dataclasses.FrozenInstanceError):
            feed.title = "changed"


class TestSnapshot:
    def _snapshot(self, error_feeds=()) -> Snapshot:
        return Snapshot(
            fetched_at=NOW,
            feeds=(_feed(),),
            unread_total=5,
            unread_by_feed={10: 5},
            unread_by_category=(),
            starred_total=2,
            error_feeds=error_feeds,
        )

    def test_construct_with_required_fields(self):
        snap = self._snapshot()
        assert snap.unread_total == 5
        assert snap.starred_total == 2

    def test_is_frozen(self):
        snap = self._snapshot()
        with pytest.raises(dataclasses.FrozenInstanceError):
            snap.unread_total = 99

    def test_error_feed_ids_empty(self):
        snap = self._snapshot(error_feeds=())
        assert snap.error_feed_ids == ()

    def test_error_feed_ids_returns_ids_of_error_feeds(self):
        f1 = _feed(id=1, parsing_error_count=2)
        f2 = _feed(id=2, parsing_error_count=1)
        snap = self._snapshot(error_feeds=(f1, f2))
        assert snap.error_feed_ids == (1, 2)
