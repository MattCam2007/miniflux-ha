"""Diff two snapshots into feed error/recovered events (architecture §2.3
step 3, §3.5). Pure — the coordinator only calls diff() and fires the
results on hass.bus.

Baseline rule: prev=None (first poll after startup) yields no events. Without
this, every already-broken feed would fire a fresh "error" event on every HA
restart, which is spam, not signal -- the feed wasn't newly broken, HA just
didn't know about it yet.

Steady-state rule: a feed that stays in the error set (even if its error
count/message changes) fires nothing further. It was already surfaced by its
original error event; re-firing on every count change would be churn, not a
new fact an automation needs to react to.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .const import EVENT_FEED_ERROR, EVENT_FEED_RECOVERED
from .models import Feed, Snapshot


@dataclass(frozen=True, slots=True)
class TransitionEvent:
    event_type: str
    payload: dict[str, Any]


def diff(prev: Snapshot | None, cur: Snapshot) -> list[TransitionEvent]:
    if prev is None:
        return []

    prev_error_ids = set(prev.error_feed_ids)
    cur_error_ids = set(cur.error_feed_ids)

    cur_feeds_by_id = {feed.id: feed for feed in cur.feeds}
    prev_error_by_id = {feed.id: feed for feed in prev.error_feeds}
    cur_error_by_id = {feed.id: feed for feed in cur.error_feeds}

    events: list[TransitionEvent] = []

    # Errors first, then recoveries; each group sorted by feed id -- a fixed,
    # deterministic order regardless of dict/set iteration order.
    for feed_id in sorted(cur_error_ids - prev_error_ids):
        feed = cur_error_by_id[feed_id]
        events.append(TransitionEvent(event_type=EVENT_FEED_ERROR, payload=_error_payload(feed)))

    for feed_id in sorted(prev_error_ids - cur_error_ids):
        # Prefer the feed's current state; fall back to its last known error
        # state if it was deleted entirely between polls (still a valid
        # recovery -- it is, vacuously, no longer erroring).
        feed = cur_feeds_by_id.get(feed_id) or prev_error_by_id[feed_id]
        events.append(
            TransitionEvent(event_type=EVENT_FEED_RECOVERED, payload=_recovered_payload(feed))
        )

    return events


def _error_payload(feed: Feed) -> dict[str, Any]:
    return {
        "feed": _feed_identity(feed),
        "parsing_error_count": feed.parsing_error_count,
        "parsing_error_message": feed.parsing_error_message,
    }


def _recovered_payload(feed: Feed) -> dict[str, Any]:
    return {"feed": _feed_identity(feed)}


def _feed_identity(feed: Feed) -> dict[str, Any]:
    return {
        "id": feed.id,
        "title": feed.title,
        "category_id": feed.category_id,
        "category_title": feed.category_title,
    }
