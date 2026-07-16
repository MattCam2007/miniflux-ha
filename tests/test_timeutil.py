"""Chunk 1.2 — time normalization (architecture §3.1 "Time normalization rule").

All time math lives in timeutil.py; nothing else does time conversion. Pure
functions only — no real now() call inside code under test; "now" is always
injected so tests are deterministic.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from custom_components.miniflux import timeutil


class TestParseTs:
    def test_offset_string_returns_utc_instant(self):
        dt = timeutil.parse_ts("2026-07-16T08:00:00+02:00")
        assert dt == datetime(2026, 7, 16, 6, 0, 0, tzinfo=UTC)
        assert dt.tzinfo is UTC

    def test_zulu_string_returns_utc(self):
        dt = timeutil.parse_ts("2026-07-16T08:00:00Z")
        assert dt == datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC)
        assert dt.tzinfo is UTC

    def test_known_local_offset_round_trips_to_correct_utc(self):
        # 23:30 EST (UTC-5, non-DST) on Jan 15 -> 04:30 UTC on Jan 16.
        dt = timeutil.parse_ts("2026-01-15T23:30:00-05:00")
        assert dt == datetime(2026, 1, 16, 4, 30, 0, tzinfo=UTC)

    def test_naive_string_raises(self):
        with pytest.raises(timeutil.TimeParseError):
            timeutil.parse_ts("2026-07-16T08:00:00")

    def test_garbage_string_raises(self):
        with pytest.raises(timeutil.TimeParseError):
            timeutil.parse_ts("not-a-timestamp")

    def test_empty_string_raises(self):
        with pytest.raises(timeutil.TimeParseError):
            timeutil.parse_ts("")

    def test_non_string_raises(self):
        with pytest.raises(timeutil.TimeParseError):
            timeutil.parse_ts(12345)  # type: ignore[arg-type]


class TestWindowToBounds:
    def test_36_hours_before_now(self):
        now = datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC)
        bound = timeutil.window_to_bounds(now, timedelta(hours=36))
        assert bound == datetime(2026, 7, 14, 20, 0, 0, tzinfo=UTC)
        assert bound.tzinfo is UTC

    def test_correct_across_dst_boundary(self):
        """36h before a post-spring-forward instant must be a true 36h instant gap,
        not a wall-clock-arithmetic result skewed by the 1h DST jump."""
        ny = ZoneInfo("America/New_York")
        # 2026-03-08 02:00 America/New_York is the US spring-forward transition.
        now = datetime(2026, 3, 9, 10, 0, 0, tzinfo=ny)
        bound = timeutil.window_to_bounds(now, timedelta(hours=36))
        assert bound.tzinfo is UTC
        assert (now.astimezone(UTC) - bound.astimezone(UTC)) == timedelta(hours=36)


class TestToFilterParam:
    def test_returns_int_epoch_seconds_matching_timestamp(self):
        dt = datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC)
        result = timeutil.to_filter_param(dt)
        assert isinstance(result, int)
        assert result == int(dt.timestamp())

    def test_offset_invariant_same_instant_same_param(self):
        utc_dt = datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC)
        plus_two_dt = datetime(2026, 7, 16, 10, 0, 0, tzinfo=timezone(timedelta(hours=2)))
        assert timeutil.to_filter_param(utc_dt) == timeutil.to_filter_param(plus_two_dt)

    def test_naive_datetime_raises(self):
        with pytest.raises(timeutil.TimeParseError):
            timeutil.to_filter_param(datetime(2026, 7, 16, 8, 0, 0))
