"""Chunk 1.8 — diff two snapshots into feed error/recovered events.

Pure; the coordinator (Phase 3) only calls diff() and fires the results on
the bus (architecture §2.3 step 3, §3.5). First-poll baseline must fire
nothing, or a restart would spam every already-broken feed as "new".
"""

from __future__ import annotations

from custom_components.miniflux import transitions
from custom_components.miniflux.const import EVENT_FEED_ERROR, EVENT_FEED_RECOVERED


class TestDiff:
    def test_first_poll_baseline_fires_nothing(self, snapshot_factory, make_feed):
        error_feed = make_feed(id=1, parsing_error_count=5)
        cur = snapshot_factory(feeds=(error_feed,), error_feeds=(error_feed,))
        assert transitions.diff(None, cur) == []

    def test_healthy_to_error_fires_error_event(self, snapshot_factory, make_feed):
        healthy = make_feed(id=1, parsing_error_count=0)
        prev = snapshot_factory(feeds=(healthy,), error_feeds=())
        errored = make_feed(id=1, parsing_error_count=3, parsing_error_message="boom")
        cur = snapshot_factory(feeds=(errored,), error_feeds=(errored,))

        events = transitions.diff(prev, cur)

        assert len(events) == 1
        assert events[0].event_type == EVENT_FEED_ERROR
        assert events[0].payload["feed"]["id"] == 1
        assert events[0].payload["parsing_error_count"] == 3
        assert events[0].payload["parsing_error_message"] == "boom"

    def test_error_to_healthy_fires_recovered_event(self, snapshot_factory, make_feed):
        errored = make_feed(id=1, parsing_error_count=3)
        prev = snapshot_factory(feeds=(errored,), error_feeds=(errored,))
        healthy = make_feed(id=1, parsing_error_count=0)
        cur = snapshot_factory(feeds=(healthy,), error_feeds=())

        events = transitions.diff(prev, cur)

        assert len(events) == 1
        assert events[0].event_type == EVENT_FEED_RECOVERED
        assert events[0].payload["feed"]["id"] == 1

    def test_feed_staying_in_error_fires_nothing(self, snapshot_factory, make_feed):
        f1 = make_feed(id=1, parsing_error_count=3)
        prev = snapshot_factory(feeds=(f1,), error_feeds=(f1,))
        # Count changed but the feed is still erroring -- no new event (avoid churn).
        f1_still_erroring = make_feed(id=1, parsing_error_count=7)
        cur = snapshot_factory(feeds=(f1_still_erroring,), error_feeds=(f1_still_erroring,))

        assert transitions.diff(prev, cur) == []

    def test_feed_staying_healthy_fires_nothing(self, snapshot_factory, make_feed):
        f1 = make_feed(id=1, parsing_error_count=0)
        prev = snapshot_factory(feeds=(f1,), error_feeds=())
        cur = snapshot_factory(feeds=(f1,), error_feeds=())
        assert transitions.diff(prev, cur) == []

    def test_simultaneous_error_and_recovery_both_events_deterministic_order(
        self, snapshot_factory, make_feed
    ):
        # Feed 2 starts healthy and becomes erroring; feed 3 starts erroring and recovers.
        f2_healthy = make_feed(id=2, parsing_error_count=0)
        f3_error = make_feed(id=3, parsing_error_count=1)
        prev = snapshot_factory(feeds=(f2_healthy, f3_error), error_feeds=(f3_error,))

        f2_error = make_feed(id=2, parsing_error_count=2)
        f3_healthy = make_feed(id=3, parsing_error_count=0)
        cur = snapshot_factory(feeds=(f2_error, f3_healthy), error_feeds=(f2_error,))

        events = transitions.diff(prev, cur)

        assert len(events) == 2
        # Deterministic order: errors before recoveries, each sorted by feed id.
        assert events[0].event_type == EVENT_FEED_ERROR
        assert events[0].payload["feed"]["id"] == 2
        assert events[1].event_type == EVENT_FEED_RECOVERED
        assert events[1].payload["feed"]["id"] == 3

    def test_flapping_across_three_snapshots(self, snapshot_factory, make_feed):
        healthy = make_feed(id=1, parsing_error_count=0)
        errored = make_feed(id=1, parsing_error_count=1)

        snap_ok = snapshot_factory(feeds=(healthy,), error_feeds=())
        snap_err = snapshot_factory(feeds=(errored,), error_feeds=(errored,))
        snap_ok_again = snapshot_factory(feeds=(healthy,), error_feeds=())

        first = transitions.diff(snap_ok, snap_err)
        assert len(first) == 1
        assert first[0].event_type == EVENT_FEED_ERROR

        second = transitions.diff(snap_err, snap_ok_again)
        assert len(second) == 1
        assert second[0].event_type == EVENT_FEED_RECOVERED

    def test_multiple_simultaneous_errors_sorted_by_id(self, snapshot_factory, make_feed):
        f5 = make_feed(id=5, parsing_error_count=0)
        f2 = make_feed(id=2, parsing_error_count=0)
        prev = snapshot_factory(feeds=(f5, f2), error_feeds=())

        f5_err = make_feed(id=5, parsing_error_count=1)
        f2_err = make_feed(id=2, parsing_error_count=1)
        cur = snapshot_factory(feeds=(f5_err, f2_err), error_feeds=(f5_err, f2_err))

        events = transitions.diff(prev, cur)
        assert [e.payload["feed"]["id"] for e in events] == [2, 5]

    def test_recovered_feed_deleted_entirely_falls_back_to_prev_state(
        self, snapshot_factory, make_feed
    ):
        error_feed = make_feed(id=1, title="Doomed Feed", parsing_error_count=5)
        prev = snapshot_factory(feeds=(error_feed,), error_feeds=(error_feed,))
        # Feed removed entirely in cur (e.g. deleted) -- no longer erroring by
        # definition, so this is a (vacuous) recovery, not a crash.
        cur = snapshot_factory(feeds=(), error_feeds=())

        events = transitions.diff(prev, cur)

        assert len(events) == 1
        assert events[0].event_type == EVENT_FEED_RECOVERED
        assert events[0].payload["feed"]["id"] == 1
        assert events[0].payload["feed"]["title"] == "Doomed Feed"

    def test_error_payload_carries_category(self, snapshot_factory, make_feed):
        prev = snapshot_factory(feeds=(make_feed(id=1, parsing_error_count=0),), error_feeds=())
        errored = make_feed(id=1, parsing_error_count=1, category_id=100, category_title="News")
        cur = snapshot_factory(feeds=(errored,), error_feeds=(errored,))

        events = transitions.diff(prev, cur)
        assert events[0].payload["feed"]["category_id"] == 100
        assert events[0].payload["feed"]["category_title"] == "News"
