"""Verified webhook body -> typed, compact, bounded event payload (architecture
§3.5, D2). Runs *after* signature verification — this module never sees a
body that hasn't already been authenticated.

Returns a ``ProjectedEvent | PayloadError`` union rather than raising: a
malformed delivery is a routine, expected outcome for a public HTTP endpoint,
not an exceptional one, and Phase 6's handler maps each case directly to an
HTTP status without wrapping every call in a try/except.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from .const import (
    EVENT_ENTRIES_CAP,
    EVENT_ENTRY_SAVED,
    EVENT_NEW_ENTRIES,
    WEBHOOK_EVENT_TYPE_NEW_ENTRIES,
    WEBHOOK_EVENT_TYPE_SAVE_ENTRY,
)
from .models import EntryCompact
from .normalize import entry_from_json

_MALFORMED_ENTRY_ERRORS = (KeyError, TypeError, ValueError, AttributeError)


@dataclass(frozen=True, slots=True)
class ProjectedEvent:
    """A typed, compact HA event ready to fire on the bus."""

    ha_event_type: str
    payload: dict[str, Any]


@dataclass(frozen=True, slots=True)
class PayloadError:
    """A verified-but-unusable delivery. Phase 6 maps this to HTTP 400."""

    reason: str


def parse_and_project(raw_body: bytes, event_type: str) -> ProjectedEvent | PayloadError:
    try:
        data = json.loads(raw_body)
    except (json.JSONDecodeError, UnicodeDecodeError) as err:
        return PayloadError(f"invalid JSON body: {err}")

    if not isinstance(data, dict):
        return PayloadError("payload must be a JSON object")

    if event_type == WEBHOOK_EVENT_TYPE_NEW_ENTRIES:
        return _project_new_entries(data)
    if event_type == WEBHOOK_EVENT_TYPE_SAVE_ENTRY:
        return _project_save_entry(data)
    return PayloadError(f"unknown event type: {event_type!r}")


def _project_new_entries(data: dict) -> ProjectedEvent | PayloadError:
    feed = data.get("feed")
    entries_raw = data.get("entries")
    if not isinstance(feed, dict) or not isinstance(entries_raw, list):
        return PayloadError("new_entries payload missing feed/entries")

    projected: list[EntryCompact] = []
    for entry_raw in entries_raw:
        try:
            entry = entry_from_json(entry_raw)
        except _MALFORMED_ENTRY_ERRORS:
            continue  # skipped; entry_count below still reflects the stated total
        projected.append(EntryCompact.from_entry(entry))

    truncated = len(projected) > EVENT_ENTRIES_CAP
    capped = projected[:EVENT_ENTRIES_CAP]
    category = feed.get("category") or {}

    payload = {
        "feed": {
            "id": feed.get("id"),
            "title": feed.get("title"),
            "category_id": category.get("id"),
            "category_title": category.get("title"),
            "site_url": feed.get("site_url"),
        },
        "entry_count": len(entries_raw),
        "entries": [_entry_compact_to_dict(entry) for entry in capped],
        "truncated": truncated,
    }
    return ProjectedEvent(ha_event_type=EVENT_NEW_ENTRIES, payload=payload)


def _project_save_entry(data: dict) -> ProjectedEvent | PayloadError:
    entry_raw = data.get("entry")
    if not isinstance(entry_raw, dict):
        return PayloadError("save_entry payload missing entry")
    try:
        entry = entry_from_json(entry_raw)
    except _MALFORMED_ENTRY_ERRORS as err:
        return PayloadError(f"malformed entry: {err}")
    compact = EntryCompact.from_entry(entry)
    return ProjectedEvent(
        ha_event_type=EVENT_ENTRY_SAVED, payload={"entry": _entry_compact_to_dict(compact)}
    )


def _entry_compact_to_dict(entry: EntryCompact) -> dict[str, Any]:
    return {
        "id": entry.id,
        "feed_id": entry.feed_id,
        "title": entry.title,
        "url": entry.url,
        "published_at": entry.published_at.isoformat(),
        "author": entry.author,
    }
