"""Chunk 1.3 — raw Miniflux JSON -> models.

Consumes synthetic fixtures (tests/fixtures/synthetic/) built against the
ASSUMED (R1) contract in plans/decisions-and-assumed-contract.md. This is
the module + normalize's field-name knowledge (alongside api.py) that the
morning contract-pinning pass will correct if reality differs.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from custom_components.miniflux import normalize

FIXTURES = Path(__file__).parent / "fixtures" / "synthetic"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


class TestEntryFromJson:
    def test_full_entry_all_fields_populated(self):
        entry = normalize.entry_from_json(_load("entry_full.json"))
        assert entry.id == 1001
        assert entry.feed_id == 10
        assert entry.title == "Example Article Title"
        assert entry.url == "https://example.com/articles/1001"
        assert entry.author == "Jane Doe"
        assert entry.status == "unread"
        assert entry.starred is False
        assert entry.reading_time == 5
        assert entry.tags == ("tech", "news")
        assert entry.content == "<p>Full article body.</p>"
        assert entry.published_at == datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC)
        assert entry.changed_at == datetime(2026, 7, 16, 8, 5, 0, tzinfo=UTC)

    def test_nested_feed_and_category_flattened(self):
        entry = normalize.entry_from_json(_load("entry_full.json"))
        assert entry.feed_title == "Example Feed"
        assert entry.category_id == 100
        assert entry.category_title == "News"

    def test_missing_content_key_is_none(self):
        entry = normalize.entry_from_json(_load("entry_no_content_key.json"))
        assert entry.content is None

    def test_empty_content_is_none(self):
        entry = normalize.entry_from_json(_load("entry_empty_content.json"))
        assert entry.content is None

    def test_missing_optional_author_and_tags_get_defaults(self):
        entry = normalize.entry_from_json(_load("entry_missing_optional.json"))
        assert entry.author == ""
        assert entry.tags == ()


class TestFeedFromJson:
    def test_healthy_feed(self):
        feed = normalize.feed_from_json(_load("feed_healthy.json"))
        assert feed.id == 10
        assert feed.parsing_error_count == 0
        assert feed.parsing_error_message == ""
        assert feed.category_id == 100
        assert feed.category_title == "News"

    def test_feed_with_parsing_error_carries_count_and_message(self):
        feed = normalize.feed_from_json(_load("feed_with_error.json"))
        assert feed.parsing_error_count == 5
        assert feed.parsing_error_message == "unable to parse feed: EOF"

    def test_feed_without_category_has_none_fields(self):
        feed = normalize.feed_from_json(_load("feed_no_category.json"))
        assert feed.category_id is None
        assert feed.category_title is None


class TestCategoryFromJson:
    def test_maps_id_and_title(self):
        category = normalize.category_from_json({"id": 100, "title": "News"})
        assert category.id == 100
        assert category.title == "News"

    def test_feed_count_and_unread_are_always_none(self):
        """G1/D-7: this call carries no snapshot to join against -- the
        service layer fills these in, never this module."""
        category = normalize.category_from_json({"id": 100, "title": "News"})
        assert category.feed_count is None
        assert category.unread is None
