"""Chunk 1.7 — feeds + counters -> Snapshot (architecture §2.3 step 2, §3.2).

Pure aggregation. Driven by `feeds` (the authoritative list), not by the
counters dict, so a feed missing a counters entry still contributes 0 rather
than silently vanishing from its category's rollup.
"""

from __future__ import annotations

from datetime import UTC, datetime

from custom_components.miniflux import rollup

NOW = datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC)


class TestBuildSnapshot:
    def test_global_total_and_category_rollup(self, make_feed):
        f1 = make_feed(id=1, category_id=100, category_title="News")
        f2 = make_feed(id=2, category_id=100, category_title="News")
        f3 = make_feed(id=3, category_id=200, category_title="Tech")
        counters = {"unreads": {1: 3, 2: 2, 3: 5}}
        snap = rollup.build_snapshot([f1, f2, f3], counters, starred_total=0, fetched_at=NOW)
        assert snap.unread_total == 10
        by_cat = {c.id: c.unread for c in snap.unread_by_category}
        assert by_cat == {100: 5, 200: 5}

    def test_feed_without_category_contributes_to_total_not_category(self, make_feed):
        f1 = make_feed(id=1, category_id=None, category_title=None)
        counters = {"unreads": {1: 7}}
        snap = rollup.build_snapshot([f1], counters, starred_total=0, fetched_at=NOW)
        assert snap.unread_total == 7
        assert snap.unread_by_category == ()

    def test_category_with_all_read_feed_appears_with_zero(self, make_feed):
        f1 = make_feed(id=1, category_id=100, category_title="News")
        counters = {"unreads": {1: 0}}
        snap = rollup.build_snapshot([f1], counters, starred_total=0, fetched_at=NOW)
        assert len(snap.unread_by_category) == 1
        assert snap.unread_by_category[0].unread == 0
        assert snap.unread_by_category[0].title == "News"

    def test_feed_missing_from_counters_dict_still_appears_with_zero(self, make_feed):
        """A feed present in `feeds` but absent from the counters payload (not
        even a zero entry) must not silently disappear from its category."""
        f1 = make_feed(id=1, category_id=100, category_title="News")
        counters = {"unreads": {}}
        snap = rollup.build_snapshot([f1], counters, starred_total=0, fetched_at=NOW)
        assert len(snap.unread_by_category) == 1
        assert snap.unread_by_category[0].unread == 0
        assert snap.unread_by_feed[1] == 0

    def test_zero_feed_category_is_absent(self):
        snap = rollup.build_snapshot([], {"unreads": {}}, starred_total=0, fetched_at=NOW)
        assert snap.unread_by_category == ()

    def test_counters_referencing_unknown_feed_id_ignored(self, make_feed):
        f1 = make_feed(id=1, category_id=100, category_title="News")
        counters = {"unreads": {1: 3, 999: 100}}  # 999 is not in `feeds`
        snap = rollup.build_snapshot([f1], counters, starred_total=0, fetched_at=NOW)
        assert snap.unread_total == 3
        assert 999 not in snap.unread_by_feed

    def test_error_feeds_contains_only_nonzero_sorted_by_id(self, make_feed):
        f1 = make_feed(id=3, parsing_error_count=2)
        f2 = make_feed(id=1, parsing_error_count=1)
        f3 = make_feed(id=2, parsing_error_count=0)
        snap = rollup.build_snapshot([f1, f2, f3], {"unreads": {}}, starred_total=0, fetched_at=NOW)
        assert [f.id for f in snap.error_feeds] == [1, 3]

    def test_no_error_feeds_when_all_healthy(self, make_feed):
        f1 = make_feed(id=1, parsing_error_count=0)
        snap = rollup.build_snapshot([f1], {"unreads": {}}, starred_total=0, fetched_at=NOW)
        assert snap.error_feeds == ()

    def test_starred_total_passed_through(self):
        snap = rollup.build_snapshot([], {"unreads": {}}, starred_total=42, fetched_at=NOW)
        assert snap.starred_total == 42

    def test_fetched_at_passed_through(self):
        snap = rollup.build_snapshot([], {"unreads": {}}, starred_total=0, fetched_at=NOW)
        assert snap.fetched_at == NOW

    def test_feeds_tuple_preserved(self, make_feed):
        f1 = make_feed(id=1)
        snap = rollup.build_snapshot([f1], {"unreads": {}}, starred_total=0, fetched_at=NOW)
        assert snap.feeds == (f1,)

    def test_multiple_categories_sorted_deterministically(self, make_feed):
        f1 = make_feed(id=1, category_id=200, category_title="Tech")
        f2 = make_feed(id=2, category_id=100, category_title="News")
        counters = {"unreads": {1: 1, 2: 1}}
        snap = rollup.build_snapshot([f1, f2], counters, starred_total=0, fetched_at=NOW)
        assert [c.id for c in snap.unread_by_category] == [100, 200]
