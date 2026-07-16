"""Time normalization — the only module that does time math (architecture §3.1).

All timestamps flowing in from Miniflux are normalized to timezone-aware UTC
here; all timestamps flowing out (query filter params) are converted here.
Nothing else in the codebase parses a timestamp or does timezone arithmetic.

Pure functions: "now" is always passed in by the caller (the coordinator
injects ``dt_util.utcnow()``), never read from the system clock here, so
these functions are deterministic under test.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta


class TimeParseError(ValueError):
    """Raised when a timestamp can't be parsed, or lacks a timezone offset."""


def parse_ts(raw: str) -> datetime:
    """Parse a Miniflux RFC 3339 timestamp into a timezone-aware UTC datetime."""
    if not isinstance(raw, str) or not raw:
        raise TimeParseError(f"timestamp must be a non-empty string: {raw!r}")
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError as err:
        raise TimeParseError(f"invalid timestamp: {raw!r}") from err
    if dt.tzinfo is None:
        raise TimeParseError(f"timestamp missing timezone offset: {raw!r}")
    return dt.astimezone(UTC)


def window_to_bounds(now: datetime, duration: timedelta) -> datetime:
    """Resolve a 'published within the last `duration`' window to its absolute
    lower bound, returned as UTC.

    Converts to UTC *before* subtracting. Subtracting a timedelta directly from
    a zoneinfo-aware datetime performs wall-clock arithmetic — if `duration`
    spans a DST transition, the result silently drifts by the transition's
    offset. Normalizing to a fixed-offset (UTC) frame first makes this a true
    absolute-instant subtraction, correct regardless of `now`'s tzinfo.
    """
    return now.astimezone(UTC) - duration


def to_filter_param(dt: datetime) -> int:
    """Convert a timezone-aware datetime to the wire form Miniflux's
    published_after/published_before filters expect: unix epoch seconds.
    ASSUMED (R1) — verify against the checklist; ``const.PARAM_PUBLISHED_*``
    are the param names this pairs with.
    """
    if dt.tzinfo is None:
        raise TimeParseError(f"datetime must be timezone-aware: {dt!r}")
    return int(dt.astimezone(UTC).timestamp())
