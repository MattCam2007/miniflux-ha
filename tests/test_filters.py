"""Chunk 1.4 — EntryFilter validation, title->id resolution, query-param encoding.

Shared by search_entries/count_entries (architecture §3.3, §4 Rule 1). Pure:
takes a Snapshot for title resolution rather than calling the API.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from custom_components.miniflux import filters
from custom_components.miniflux.const import SEARCH_LIMIT_MAX
from custom_components.miniflux.filters import EntryFilter

NOW = datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC)


class TestValidate:
    def test_default_filter_is_valid(self):
        EntryFilter().validate()  # must not raise

    def test_published_within_combined_with_after_raises(self):
        f = EntryFilter(published_within=timedelta(hours=36), published_after=NOW)
        with pytest.raises(filters.FilterError):
            f.validate()

    def test_published_within_combined_with_before_raises(self):
        f = EntryFilter(published_within=timedelta(hours=36), published_before=NOW)
        with pytest.raises(filters.FilterError):
            f.validate()

    def test_published_within_alone_is_valid(self):
        EntryFilter(published_within=timedelta(hours=36)).validate()

    def test_published_after_and_before_together_is_valid(self):
        EntryFilter(published_after=NOW - timedelta(days=1), published_before=NOW).validate()

    def test_limit_over_max_raises_naming_the_cap(self):
        f = EntryFilter(limit=SEARCH_LIMIT_MAX + 1)
        with pytest.raises(filters.FilterError, match=str(SEARCH_LIMIT_MAX)):
            f.validate()

    def test_limit_at_max_is_valid(self):
        EntryFilter(limit=SEARCH_LIMIT_MAX).validate()

    def test_limit_zero_raises(self):
        with pytest.raises(filters.FilterError):
            EntryFilter(limit=0).validate()

    def test_unknown_status_raises(self):
        f = EntryFilter(status=("bogus",))
        with pytest.raises(filters.FilterError):
            f.validate()

    def test_empty_status_tuple_is_valid(self):
        """Deliberately allowed: means 'match any status' (see
        TestToQueryParams.test_empty_status_tuple_omits_status_param)."""
        EntryFilter(status=()).validate()

    def test_known_statuses_are_valid(self):
        EntryFilter(status=("unread", "read", "removed")).validate()


class TestResolveRefs:
    def test_numeric_category_passes_through_untouched(self, snapshot_factory):
        snap = snapshot_factory()
        resolved = filters.resolve_refs(EntryFilter(category=100), snap)
        assert resolved.category_id == 100

    def test_numeric_feed_passes_through_untouched(self, snapshot_factory):
        snap = snapshot_factory()
        resolved = filters.resolve_refs(EntryFilter(feed=10), snap)
        assert resolved.feed_id == 10

    def test_none_category_and_feed_pass_through_as_none(self, snapshot_factory):
        snap = snapshot_factory()
        resolved = filters.resolve_refs(EntryFilter(), snap)
        assert resolved.category_id is None
        assert resolved.feed_id is None

    def test_category_title_present_once_resolves_to_id(self, snapshot_factory, make_feed):
        feed = make_feed(id=1, category_id=100, category_title="News")
        snap = snapshot_factory(feeds=(feed,))
        resolved = filters.resolve_refs(EntryFilter(category="News"), snap)
        assert resolved.category_id == 100

    def test_category_title_absent_raises(self, snapshot_factory, make_feed):
        feed = make_feed(id=1, category_id=100, category_title="News")
        snap = snapshot_factory(feeds=(feed,))
        with pytest.raises(filters.FilterError, match="Nonexistent"):
            filters.resolve_refs(EntryFilter(category="Nonexistent"), snap)

    def test_category_title_ambiguous_raises(self, snapshot_factory, make_feed):
        # Two distinct categories that happen to share a title.
        f1 = make_feed(id=1, category_id=100, category_title="Tech")
        f2 = make_feed(id=2, category_id=200, category_title="Tech")
        snap = snapshot_factory(feeds=(f1, f2))
        with pytest.raises(filters.FilterError, match="ambiguous"):
            filters.resolve_refs(EntryFilter(category="Tech"), snap)

    def test_category_title_same_category_multiple_feeds_not_ambiguous(
        self, snapshot_factory, make_feed
    ):
        # Two feeds in the *same* category must resolve cleanly, not "ambiguous".
        f1 = make_feed(id=1, category_id=100, category_title="News")
        f2 = make_feed(id=2, category_id=100, category_title="News")
        snap = snapshot_factory(feeds=(f1, f2))
        resolved = filters.resolve_refs(EntryFilter(category="News"), snap)
        assert resolved.category_id == 100

    def test_feed_title_present_once_resolves_to_id(self, snapshot_factory, make_feed):
        feed = make_feed(id=42, title="My Blog")
        snap = snapshot_factory(feeds=(feed,))
        resolved = filters.resolve_refs(EntryFilter(feed="My Blog"), snap)
        assert resolved.feed_id == 42

    def test_feed_title_absent_raises(self, snapshot_factory, make_feed):
        feed = make_feed(id=42, title="My Blog")
        snap = snapshot_factory(feeds=(feed,))
        with pytest.raises(filters.FilterError, match="Nonexistent"):
            filters.resolve_refs(EntryFilter(feed="Nonexistent"), snap)

    def test_feed_title_ambiguous_raises(self, snapshot_factory, make_feed):
        f1 = make_feed(id=1, title="Blog")
        f2 = make_feed(id=2, title="Blog")
        snap = snapshot_factory(feeds=(f1, f2))
        with pytest.raises(filters.FilterError, match="ambiguous"):
            filters.resolve_refs(EntryFilter(feed="Blog"), snap)

    def test_resolved_carries_through_other_fields_unchanged(self, snapshot_factory):
        snap = snapshot_factory()
        f = EntryFilter(status=("read",), starred=True, search="foo", limit=50)
        resolved = filters.resolve_refs(f, snap)
        assert resolved.status == ("read",)
        assert resolved.starred is True
        assert resolved.search == "foo"
        assert resolved.limit == 50


class TestToQueryParams:
    def _resolved(self, snapshot_factory, **overrides):
        snap = snapshot_factory()
        f = EntryFilter(**overrides)
        return filters.resolve_refs(f, snap)

    def test_default_status_unread_present(self, snapshot_factory):
        resolved = self._resolved(snapshot_factory)
        params = filters.to_query_params(resolved, NOW)
        assert params["status"] == ["unread"]

    def test_multiple_statuses_become_list_param(self, snapshot_factory):
        resolved = self._resolved(snapshot_factory, status=("unread", "read"))
        params = filters.to_query_params(resolved, NOW)
        assert params["status"] == ["unread", "read"]

    def test_empty_status_tuple_omits_status_param(self, snapshot_factory):
        """Empty status is a deliberate 'any status' query, not an error
        (validate() allows it) -- Miniflux returns all statuses when no
        status param is sent at all."""
        resolved = self._resolved(snapshot_factory, status=())
        params = filters.to_query_params(resolved, NOW)
        assert "status" not in params

    def test_category_and_feed_ids_included_when_set(self, snapshot_factory):
        resolved = self._resolved(snapshot_factory, category=100, feed=10)
        params = filters.to_query_params(resolved, NOW)
        assert params["category_id"] == 100
        assert params["feed_id"] == 10

    def test_category_and_feed_absent_when_none(self, snapshot_factory):
        resolved = self._resolved(snapshot_factory)
        params = filters.to_query_params(resolved, NOW)
        assert "category_id" not in params
        assert "feed_id" not in params

    def test_starred_included_when_set(self, snapshot_factory):
        resolved = self._resolved(snapshot_factory, starred=True)
        params = filters.to_query_params(resolved, NOW)
        assert params["starred"] is True

    def test_search_included_when_set(self, snapshot_factory):
        resolved = self._resolved(snapshot_factory, search="the")
        params = filters.to_query_params(resolved, NOW)
        assert params["search"] == "the"

    def test_published_within_becomes_absolute_published_after(self, snapshot_factory):
        resolved = self._resolved(snapshot_factory, published_within=timedelta(hours=36))
        params = filters.to_query_params(resolved, NOW)
        expected_bound = NOW - timedelta(hours=36)
        assert params["published_after"] == int(expected_bound.timestamp())
        assert "published_before" not in params

    def test_explicit_published_after_before_pass_through(self, snapshot_factory):
        after = NOW - timedelta(days=2)
        before = NOW - timedelta(days=1)
        resolved = self._resolved(snapshot_factory, published_after=after, published_before=before)
        params = filters.to_query_params(resolved, NOW)
        assert params["published_after"] == int(after.timestamp())
        assert params["published_before"] == int(before.timestamp())

    def test_order_and_direction_included_when_set(self, snapshot_factory):
        resolved = self._resolved(snapshot_factory, order="published_at", direction="desc")
        params = filters.to_query_params(resolved, NOW)
        assert params["order"] == "published_at"
        assert params["direction"] == "desc"

    def test_limit_always_included(self, snapshot_factory):
        resolved = self._resolved(snapshot_factory, limit=42)
        params = filters.to_query_params(resolved, NOW)
        assert params["limit"] == 42


class TestValidateEntryIds:
    def test_empty_raises(self):
        with pytest.raises(filters.FilterError):
            filters.validate_entry_ids([], max_count=100)

    def test_over_max_raises(self):
        with pytest.raises(filters.FilterError):
            filters.validate_entry_ids(list(range(101)), max_count=100)

    def test_within_bounds_does_not_raise(self):
        filters.validate_entry_ids([1, 2, 3], max_count=100)

    def test_exactly_at_max_does_not_raise(self):
        filters.validate_entry_ids(list(range(100)), max_count=100)
