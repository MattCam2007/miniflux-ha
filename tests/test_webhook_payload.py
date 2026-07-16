"""Chunk 1.6 — verified webhook body -> typed, compact, bounded event payload.

Runs *after* signature verification (architecture §3.4, D2). The headline
guarantee under test: article content never leaks into the emitted payload,
and one malformed entry never drops the true count or crashes the batch.
"""

from __future__ import annotations

import json

from custom_components.miniflux import webhook_payload
from custom_components.miniflux.const import EVENT_ENTRIES_CAP, EVENT_ENTRY_SAVED, EVENT_NEW_ENTRIES


def _raw_entry(entry_id: int, *, malformed: bool = False) -> dict:
    if malformed:
        # Missing required fields (id/title/url/etc.) -> entry_from_json raises.
        return {"not_a_real_entry": True}
    return {
        "id": entry_id,
        "feed_id": 10,
        "status": "unread",
        "title": f"Entry {entry_id}",
        "url": f"https://example.com/{entry_id}",
        "author": "Jane Doe",
        "content": "<p>Full body that must never leak into the event.</p>",
        "starred": False,
        "reading_time": 3,
        "published_at": "2026-07-16T08:00:00Z",
        "changed_at": "2026-07-16T08:00:00Z",
        "tags": [],
    }


def _feed_json() -> dict:
    return {
        "id": 10,
        "title": "Example Feed",
        "site_url": "https://example.com",
        "category": {"id": 100, "title": "News"},
    }


def _new_entries_body(entry_count: int, *, malformed_indices: set[int] = frozenset()) -> bytes:
    entries = [
        _raw_entry(i, malformed=i in malformed_indices) for i in range(entry_count)
    ]
    body = {"event_type": "new_entries", "feed": _feed_json(), "entries": entries}
    return json.dumps(body).encode()


def _no_content_leak(obj) -> bool:
    """Recursively assert no dict in the structure has a 'content' key."""
    if isinstance(obj, dict):
        if "content" in obj:
            return False
        return all(_no_content_leak(v) for v in obj.values())
    if isinstance(obj, list):
        return all(_no_content_leak(v) for v in obj)
    return True


class TestNewEntries:
    def test_large_batch_capped_and_truncated(self):
        body = _new_entries_body(200)
        result = webhook_payload.parse_and_project(body, "new_entries")
        assert isinstance(result, webhook_payload.ProjectedEvent)
        assert result.ha_event_type == EVENT_NEW_ENTRIES
        assert len(result.payload["entries"]) == EVENT_ENTRIES_CAP
        assert result.payload["truncated"] is True
        assert result.payload["entry_count"] == 200

    def test_small_batch_not_truncated_count_matches(self):
        body = _new_entries_body(5)
        result = webhook_payload.parse_and_project(body, "new_entries")
        assert len(result.payload["entries"]) == 5
        assert result.payload["truncated"] is False
        assert result.payload["entry_count"] == 5

    def test_malformed_entry_skipped_others_projected_count_intact(self):
        body = _new_entries_body(5, malformed_indices={2})
        result = webhook_payload.parse_and_project(body, "new_entries")
        # Stated/total count reflects the payload, not the post-filter count.
        assert result.payload["entry_count"] == 5
        # Only the 4 well-formed entries were actually projected.
        assert len(result.payload["entries"]) == 4
        projected_ids = {e["id"] for e in result.payload["entries"]}
        assert projected_ids == {0, 1, 3, 4}

    def test_many_malformed_entries_under_cap_not_marked_truncated(self):
        """truncated means 'cut for the cap', not 'some entries were bad'."""
        body = _new_entries_body(10, malformed_indices={1, 3, 5, 7, 9})
        result = webhook_payload.parse_and_project(body, "new_entries")
        assert result.payload["entry_count"] == 10
        assert len(result.payload["entries"]) == 5
        assert result.payload["truncated"] is False

    def test_feed_fields_present(self):
        body = _new_entries_body(1)
        result = webhook_payload.parse_and_project(body, "new_entries")
        feed = result.payload["feed"]
        assert feed["id"] == 10
        assert feed["title"] == "Example Feed"
        assert feed["category_id"] == 100
        assert feed["category_title"] == "News"

    def test_no_content_key_anywhere_in_payload(self):
        body = _new_entries_body(3)
        result = webhook_payload.parse_and_project(body, "new_entries")
        assert _no_content_leak(result.payload) is True

    def test_missing_feed_key_is_payload_error(self):
        body = json.dumps({"event_type": "new_entries", "entries": []}).encode()
        result = webhook_payload.parse_and_project(body, "new_entries")
        assert isinstance(result, webhook_payload.PayloadError)

    def test_missing_entries_key_is_payload_error(self):
        body = json.dumps({"event_type": "new_entries", "feed": _feed_json()}).encode()
        result = webhook_payload.parse_and_project(body, "new_entries")
        assert isinstance(result, webhook_payload.PayloadError)


class TestSaveEntry:
    def test_projects_single_entry_compact(self):
        body = json.dumps({"event_type": "save_entry", "entry": _raw_entry(42)}).encode()
        result = webhook_payload.parse_and_project(body, "save_entry")
        assert isinstance(result, webhook_payload.ProjectedEvent)
        assert result.ha_event_type == EVENT_ENTRY_SAVED
        assert result.payload["entry"]["id"] == 42

    def test_no_content_key_in_payload(self):
        body = json.dumps({"event_type": "save_entry", "entry": _raw_entry(42)}).encode()
        result = webhook_payload.parse_and_project(body, "save_entry")
        assert _no_content_leak(result.payload) is True

    def test_missing_entry_key_is_payload_error(self):
        body = json.dumps({"event_type": "save_entry"}).encode()
        result = webhook_payload.parse_and_project(body, "save_entry")
        assert isinstance(result, webhook_payload.PayloadError)

    def test_malformed_entry_is_payload_error(self):
        body = json.dumps({"event_type": "save_entry", "entry": {"not_real": True}}).encode()
        result = webhook_payload.parse_and_project(body, "save_entry")
        assert isinstance(result, webhook_payload.PayloadError)


class TestMalformedInput:
    def test_non_json_body_is_payload_error(self):
        result = webhook_payload.parse_and_project(b"not json at all {{{", "new_entries")
        assert isinstance(result, webhook_payload.PayloadError)

    def test_json_array_top_level_is_payload_error(self):
        result = webhook_payload.parse_and_project(b"[1, 2, 3]", "new_entries")
        assert isinstance(result, webhook_payload.PayloadError)

    def test_unknown_event_type_is_payload_error(self):
        body = json.dumps({"event_type": "something_else"}).encode()
        result = webhook_payload.parse_and_project(body, "something_else")
        assert isinstance(result, webhook_payload.PayloadError)

    def test_empty_body_is_payload_error(self):
        result = webhook_payload.parse_and_project(b"", "new_entries")
        assert isinstance(result, webhook_payload.PayloadError)
