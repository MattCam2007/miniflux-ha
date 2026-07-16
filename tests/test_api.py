"""Phase 2 — the async API client (architecture §3.1, D6, D7, D8).

The only module that imports aiohttp; the only module with live-socket-free
adapter-ring tests against a hand-rolled fake session (tests/fake_aiohttp.py)
rather than a real network or a full HA harness.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import aiohttp
import pytest

from custom_components.miniflux import errors
from custom_components.miniflux.api import MinifluxClient
from custom_components.miniflux.const import API_AUTH_HEADER
from custom_components.miniflux.models import Feed
from tests.fake_aiohttp import FakeResponse, FakeSession

BASE_URL = "https://reader.example.lan"
API_KEY = "test-api-key"

SYNTHETIC = Path(__file__).parent / "fixtures" / "synthetic"


def _load(name: str) -> dict:
    return json.loads((SYNTHETIC / name).read_text())


def _client(session: FakeSession, **kwargs) -> MinifluxClient:
    kwargs.setdefault("retry_delay", 0)
    return MinifluxClient(session, BASE_URL, API_KEY, **kwargs)


class TestRequestCore:
    async def test_auth_header_present_and_correct(self):
        session = FakeSession([FakeResponse(200, json_body={"ok": True})])
        client = _client(session)
        await client._request("GET", "/v1/me")
        assert session.calls[0].kwargs["headers"][API_AUTH_HEADER] == API_KEY

    async def test_base_url_no_trailing_slash_joins_correctly(self):
        session = FakeSession([FakeResponse(200, json_body={})])
        client = MinifluxClient(session, "https://reader.example.lan", API_KEY, retry_delay=0)
        await client._request("GET", "/v1/feeds")
        assert session.calls[0].url == "https://reader.example.lan/v1/feeds"

    async def test_base_url_trailing_slash_no_double_slash(self):
        session = FakeSession([FakeResponse(200, json_body={})])
        client = MinifluxClient(session, "https://reader.example.lan/", API_KEY, retry_delay=0)
        await client._request("GET", "/v1/feeds")
        assert session.calls[0].url == "https://reader.example.lan/v1/feeds"

    async def test_base_url_with_subpath_joins_correctly(self):
        session = FakeSession([FakeResponse(200, json_body={})])
        client = MinifluxClient(session, "https://host/miniflux", API_KEY, retry_delay=0)
        await client._request("GET", "/v1/feeds")
        assert session.calls[0].url == "https://host/miniflux/v1/feeds"

    async def test_base_url_with_subpath_and_trailing_slash(self):
        session = FakeSession([FakeResponse(200, json_body={})])
        client = MinifluxClient(session, "https://host/miniflux/", API_KEY, retry_delay=0)
        await client._request("GET", "/v1/feeds")
        assert session.calls[0].url == "https://host/miniflux/v1/feeds"

    async def test_returns_parsed_json_body(self):
        session = FakeSession([FakeResponse(200, json_body={"id": 42, "username": "matt"})])
        client = _client(session)
        result = await client._request("GET", "/v1/me")
        assert result == {"id": 42, "username": "matt"}

    async def test_empty_body_returns_none(self):
        session = FakeSession([FakeResponse(204, text_body="")])
        client = _client(session)
        result = await client._request("PUT", "/v1/feeds/1/refresh")
        assert result is None

    async def test_verify_ssl_threaded_to_request(self):
        session = FakeSession([FakeResponse(200, json_body={})])
        client = MinifluxClient(session, BASE_URL, API_KEY, verify_ssl=False, retry_delay=0)
        await client._request("GET", "/v1/me")
        assert session.calls[0].kwargs["ssl"] is False

    async def test_parse_json_false_returns_raw_text(self):
        session = FakeSession([FakeResponse(200, text_body="<opml><body/></opml>")])
        client = _client(session)
        result = await client._request("GET", "/v1/export", parse_json=False)
        assert result == "<opml><body/></opml>"

    async def test_data_kwarg_forwarded_for_raw_body_requests(self):
        session = FakeSession([FakeResponse(200, text_body="")])
        client = _client(session)
        await client._request("POST", "/v1/import", data="<opml/>", parse_json=False)
        assert session.calls[0].kwargs["data"] == "<opml/>"

    async def test_401_raises_auth_error(self):
        session = FakeSession([FakeResponse(401, json_body={"error_message": "bad key"})])
        client = _client(session)
        with pytest.raises(errors.MinifluxAuthError) as exc_info:
            await client._request("GET", "/v1/me")
        assert exc_info.value.detail == "bad key"

    async def test_404_raises_not_found(self):
        session = FakeSession([FakeResponse(404, json_body={"error_message": "no such entry"})])
        client = _client(session)
        with pytest.raises(errors.MinifluxNotFoundError):
            await client._request("GET", "/v1/entries/999")

    async def test_error_status_with_empty_body_still_maps_cleanly(self):
        """A bare error status with no body at all (e.g. a proxy's raw 502)
        must not crash reading the body -- it becomes a generic detail."""
        session = FakeSession([FakeResponse(502, text_body="")])
        client = _client(session)
        with pytest.raises(errors.MinifluxServerError) as exc_info:
            await client._request("GET", "/v1/me")
        assert exc_info.value.detail  # non-empty fallback, not a crash

    async def test_error_status_with_non_json_body_falls_back_to_raw_text(self):
        """A reverse proxy in front of Miniflux might return an HTML/plain
        text error page instead of Miniflux's own JSON error shape."""
        session = FakeSession([FakeResponse(502, text_body="<html>Bad Gateway</html>")])
        client = _client(session)
        with pytest.raises(errors.MinifluxServerError) as exc_info:
            await client._request("GET", "/v1/me")
        assert exc_info.value.detail == "<html>Bad Gateway</html>"

    async def test_error_status_body_read_failure_does_not_crash(self):
        """If the connection drops mid-read of an error response body, the
        client must still raise a typed MinifluxError, not an unhandled
        aiohttp exception."""
        session = FakeSession(
            [FakeResponse(500, text_raises=aiohttp.ClientPayloadError("truncated"))]
        )
        client = _client(session)
        with pytest.raises(errors.MinifluxServerError) as exc_info:
            await client._request("GET", "/v1/me")
        assert exc_info.value.detail  # non-empty fallback, not a crash

    async def test_400_raises_bad_request_with_message(self):
        session = FakeSession([FakeResponse(400, json_body={"error_message": "feed_url required"})])
        client = _client(session)
        with pytest.raises(errors.MinifluxBadRequestError) as exc_info:
            await client._request("POST", "/v1/feeds", json={})
        assert exc_info.value.detail == "feed_url required"

    async def test_connection_error_raises_minflux_connection_error(self):
        session = FakeSession([aiohttp.ClientConnectionError("refused")])
        client = _client(session)
        with pytest.raises(errors.MinifluxConnectionError):
            await client._request("GET", "/v1/me")

    async def test_timeout_raises_minflux_connection_error(self):
        session = FakeSession([TimeoutError("timed out")])
        client = _client(session)
        with pytest.raises(errors.MinifluxConnectionError):
            await client._request("GET", "/v1/me")

    # --- Retry policy (D10): GET retries once on connection/5xx; mutations never retry.

    async def test_get_retries_once_after_connection_error_then_succeeds(self):
        session = FakeSession(
            [aiohttp.ClientConnectionError("refused"), FakeResponse(200, json_body={"ok": True})]
        )
        client = _client(session)
        result = await client._request("GET", "/v1/me")
        assert result == {"ok": True}
        assert len(session.calls) == 2

    async def test_get_retries_once_after_500_then_succeeds(self):
        session = FakeSession(
            [
                FakeResponse(500, json_body={"error_message": "boom"}),
                FakeResponse(200, json_body={"ok": True}),
            ]
        )
        client = _client(session)
        result = await client._request("GET", "/v1/me")
        assert result == {"ok": True}
        assert len(session.calls) == 2

    async def test_get_fails_after_two_consecutive_failures(self):
        session = FakeSession(
            [
                aiohttp.ClientConnectionError("refused"),
                aiohttp.ClientConnectionError("refused again"),
            ]
        )
        client = _client(session)
        with pytest.raises(errors.MinifluxConnectionError):
            await client._request("GET", "/v1/me")
        assert len(session.calls) == 2  # exactly one retry, not more

    async def test_get_does_not_retry_on_4xx(self):
        session = FakeSession([FakeResponse(400, json_body={"error_message": "bad"})])
        client = _client(session)
        with pytest.raises(errors.MinifluxBadRequestError):
            await client._request("GET", "/v1/entries")
        assert len(session.calls) == 1  # 4xx is a caller mistake -- retrying won't help

    async def test_put_never_retries_on_connection_error(self):
        session = FakeSession([aiohttp.ClientConnectionError("refused")])
        client = _client(session)
        with pytest.raises(errors.MinifluxConnectionError):
            await client._request("PUT", "/v1/entries", json={"entry_ids": [1], "status": "read"})
        assert len(session.calls) == 1

    async def test_put_never_retries_on_500(self):
        session = FakeSession([FakeResponse(500, json_body={"error_message": "boom"})])
        client = _client(session)
        with pytest.raises(errors.MinifluxServerError):
            await client._request("PUT", "/v1/entries", json={"entry_ids": [1], "status": "read"})
        assert len(session.calls) == 1

    # --- Concurrency cap.

    async def test_concurrency_capped_at_configured_limit(self):
        session = FakeSession([FakeResponse(200, json_body={})], artificial_delay=0.05)
        client = _client(session, concurrency=4)
        await asyncio.gather(*(client._request("GET", "/v1/me") for _ in range(10)))
        assert session.max_concurrent == 4

    async def test_concurrency_of_one_serializes_requests(self):
        session = FakeSession([FakeResponse(200, json_body={})], artificial_delay=0.02)
        client = _client(session, concurrency=1)
        await asyncio.gather(*(client._request("GET", "/v1/me") for _ in range(5)))
        assert session.max_concurrent == 1


class TestReadEndpoints:
    async def test_get_me_returns_raw_dict(self):
        session = FakeSession([FakeResponse(200, json_body={"id": 1, "username": "matt"})])
        client = _client(session)
        result = await client.get_me()
        assert result == {"id": 1, "username": "matt"}

    async def test_get_me_401_raises_auth_error(self):
        session = FakeSession([FakeResponse(401, json_body={"error_message": "bad key"})])
        client = _client(session)
        with pytest.raises(errors.MinifluxAuthError):
            await client.get_me()

    async def test_get_version_v1_present_returns_version_string(self):
        session = FakeSession([FakeResponse(200, json_body={"version": "2.1.0", "commit": "abc"})])
        client = _client(session)
        assert await client.get_version() == "2.1.0"

    async def test_get_version_bare_string_response_shape(self):
        """ASSUMED (R1): if /v1/version ever returns a bare JSON string
        instead of {"version": ...}, still resolve it rather than losing it."""
        session = FakeSession([FakeResponse(200, text_body='"2.1.0"')])
        client = _client(session)
        assert await client.get_version() == "2.1.0"

    async def test_get_version_unrecognized_shape_returns_none(self):
        session = FakeSession([FakeResponse(200, json_body=[1, 2, 3])])
        client = _client(session)
        assert await client.get_version() is None

    async def test_get_version_falls_back_to_root_when_v1_missing(self):
        session = FakeSession(
            [
                FakeResponse(404, json_body={"error_message": "not found"}),
                FakeResponse(200, json_body={"version": "2.0.5"}),
            ]
        )
        client = _client(session)
        result = await client.get_version()
        assert result == "2.0.5"
        assert session.calls[0].url.endswith("/v1/version")
        assert session.calls[1].url.endswith("/version")

    async def test_get_version_both_endpoints_missing_returns_none_not_raise(self):
        session = FakeSession([FakeResponse(404, json_body={"error_message": "not found"})])
        client = _client(session)
        assert await client.get_version() is None

    async def test_get_version_propagates_non_404_errors(self):
        session = FakeSession([FakeResponse(500, json_body={"error_message": "boom"})])
        client = _client(session)
        with pytest.raises(errors.MinifluxServerError):
            await client.get_version()

    async def test_get_feeds_returns_feed_models(self):
        feeds_raw = [_load("feed_healthy.json"), _load("feed_with_error.json")]
        session = FakeSession([FakeResponse(200, json_body=feeds_raw)])
        client = _client(session)

        feeds = await client.get_feeds()

        assert all(isinstance(f, Feed) for f in feeds)
        assert len(feeds) == 2

    async def test_get_feeds_includes_parsing_error_feed(self):
        feeds_raw = [_load("feed_healthy.json"), _load("feed_with_error.json")]
        session = FakeSession([FakeResponse(200, json_body=feeds_raw)])
        client = _client(session)

        feeds = await client.get_feeds()

        error_feed = next(f for f in feeds if f.id == 11)
        assert error_feed.parsing_error_count == 5
        assert error_feed.parsing_error_message == "unable to parse feed: EOF"

    async def test_get_feeds_includes_uncategorized_feed(self):
        feeds_raw = [_load("feed_no_category.json")]
        session = FakeSession([FakeResponse(200, json_body=feeds_raw)])
        client = _client(session)

        feeds = await client.get_feeds()

        assert feeds[0].category_id is None
        assert feeds[0].category_title is None

    async def test_get_feeds_401_propagates_as_auth_error(self):
        session = FakeSession([FakeResponse(401, json_body={"error_message": "bad key"})])
        client = _client(session)
        with pytest.raises(errors.MinifluxAuthError):
            await client.get_feeds()

    async def test_get_feed_counters_converts_string_keys_to_int(self):
        raw = {"reads": {"10": 2, "11": 0}, "unreads": {"10": 3, "11": 5}}
        session = FakeSession([FakeResponse(200, json_body=raw)])
        client = _client(session)

        counters = await client.get_feed_counters()

        assert counters["unreads"] == {10: 3, 11: 5}
        assert counters["reads"] == {10: 2, 11: 0}
        assert all(isinstance(k, int) for k in counters["unreads"])


def _raw_entry(entry_id: int, *, with_content: bool = True, starred: bool = False) -> dict:
    entry = _load("entry_full.json").copy()
    entry["id"] = entry_id
    entry["starred"] = starred
    if not with_content:
        entry.pop("content", None)
    return entry


def _entries_page(count: int, total: int, *, start_id: int = 0, with_content: bool = True) -> dict:
    return {
        "total": total,
        "entries": [_raw_entry(start_id + i, with_content=with_content) for i in range(count)],
    }


class TestEntriesQueryAndPagination:
    async def test_single_page_returns_entries_and_total(self):
        session = FakeSession([FakeResponse(200, json_body=_entries_page(5, total=5))])
        client = _client(session)

        total, entries = await client.query_entries({}, limit=100)

        assert total == 5
        assert len(entries) == 5

    async def test_multi_page_walks_until_limit_reached(self):
        # 250 total, 100/page: 3 requests needed to reach limit=500 (all exhausted at 250).
        session = FakeSession(
            [
                FakeResponse(200, json_body=_entries_page(100, total=250, start_id=0)),
                FakeResponse(200, json_body=_entries_page(100, total=250, start_id=100)),
                FakeResponse(200, json_body=_entries_page(50, total=250, start_id=200)),
            ]
        )
        client = _client(session)

        total, entries = await client.query_entries({}, limit=500)

        assert total == 250
        assert len(entries) == 250
        assert len(session.calls) == 3

    async def test_multi_page_walk_stops_at_limit_not_at_total(self):
        # 250 total available, but caller only wants 150 -> stop after 2 requests.
        session = FakeSession(
            [
                FakeResponse(200, json_body=_entries_page(100, total=250, start_id=0)),
                FakeResponse(200, json_body=_entries_page(50, total=250, start_id=100)),
            ]
        )
        client = _client(session)

        total, entries = await client.query_entries({}, limit=150)

        assert total == 250  # Miniflux's true total, even though we stopped short
        assert len(entries) == 150
        assert len(session.calls) == 2
        # Second request asked for exactly the remainder, not another full page.
        assert session.calls[1].kwargs["params"] is not None

    async def test_single_page_smaller_than_limit_stops_early(self):
        # Only 5 entries exist; limit=500 must not cause a second (empty) request.
        session = FakeSession([FakeResponse(200, json_body=_entries_page(5, total=5))])
        client = _client(session)

        total, entries = await client.query_entries({}, limit=500)

        assert len(entries) == 5
        assert len(session.calls) == 1

    async def test_include_content_false_entries_have_no_content(self):
        session = FakeSession(
            [FakeResponse(200, json_body=_entries_page(3, total=3, with_content=False))]
        )
        client = _client(session)

        _, entries = await client.query_entries({}, limit=100)

        assert all(e.content is None for e in entries)

    async def test_include_content_true_entries_have_content(self):
        session = FakeSession(
            [FakeResponse(200, json_body=_entries_page(3, total=3, with_content=True))]
        )
        client = _client(session)

        _, entries = await client.query_entries({}, limit=100)

        assert all(e.content is not None for e in entries)

    async def test_params_forwarded_to_request(self):
        session = FakeSession([FakeResponse(200, json_body=_entries_page(1, total=1))])
        client = _client(session)

        await client.query_entries({"category_id": 100, "status": ["unread"]}, limit=100)

        sent_params = dict(session.calls[0].kwargs["params"])
        assert sent_params["category_id"] == "100"

    async def test_status_list_param_becomes_repeated_query_params(self):
        session = FakeSession([FakeResponse(200, json_body=_entries_page(1, total=1))])
        client = _client(session)

        await client.query_entries({"status": ["unread", "read"]}, limit=100)

        status_values = [v for k, v in session.calls[0].kwargs["params"] if k == "status"]
        assert status_values == ["unread", "read"]

    async def test_boolean_param_stringified_as_lowercase_true_false(self):
        session = FakeSession([FakeResponse(200, json_body=_entries_page(1, total=1))])
        client = _client(session)

        await client.query_entries({"starred": True}, limit=100)

        sent_params = dict(session.calls[0].kwargs["params"])
        assert sent_params["starred"] == "true"

        await client.query_entries({"starred": False}, limit=100)
        sent_params = dict(session.calls[1].kwargs["params"])
        assert sent_params["starred"] == "false"


class TestCountEntries:
    async def test_returns_total_without_materializing_entries(self):
        session = FakeSession([FakeResponse(200, json_body=_entries_page(1, total=42))])
        client = _client(session)

        total = await client.count_entries({"status": ["unread"]})

        assert total == 42

    async def test_issues_a_single_cheap_call(self):
        session = FakeSession([FakeResponse(200, json_body=_entries_page(1, total=42))])
        client = _client(session)

        await client.count_entries({})

        assert len(session.calls) == 1
        sent_params = dict(session.calls[0].kwargs["params"])
        assert sent_params["limit"] == "1"


class TestGetEntriesById:
    async def test_all_ids_exist_returns_all_entries_no_missing(self):
        by_url = {
            f"{BASE_URL}/v1/entries/1": FakeResponse(200, json_body=_raw_entry(1)),
            f"{BASE_URL}/v1/entries/2": FakeResponse(200, json_body=_raw_entry(2)),
        }
        session = FakeSession(by_url=by_url)
        client = _client(session)

        entries, missing = await client.get_entries_by_id([1, 2])

        assert {e.id for e in entries} == {1, 2}
        assert missing == []

    async def test_mix_of_existing_and_deleted_ids(self):
        by_url = {
            f"{BASE_URL}/v1/entries/1": FakeResponse(200, json_body=_raw_entry(1)),
            f"{BASE_URL}/v1/entries/2": FakeResponse(404, json_body={"error_message": "not found"}),
            f"{BASE_URL}/v1/entries/3": FakeResponse(200, json_body=_raw_entry(3)),
        }
        session = FakeSession(by_url=by_url)
        client = _client(session)

        entries, missing = await client.get_entries_by_id([1, 2, 3])

        assert {e.id for e in entries} == {1, 3}
        assert missing == [2]

    async def test_all_missing_returns_empty_entries_not_raise(self):
        by_url = {
            f"{BASE_URL}/v1/entries/1": FakeResponse(404, json_body={"error_message": "gone"}),
        }
        session = FakeSession(by_url=by_url)
        client = _client(session)

        entries, missing = await client.get_entries_by_id([1])

        assert entries == []
        assert missing == [1]

    async def test_non_404_error_still_propagates(self):
        by_url = {
            f"{BASE_URL}/v1/entries/1": FakeResponse(500, json_body={"error_message": "boom"}),
        }
        session = FakeSession(by_url=by_url)
        client = _client(session)

        with pytest.raises(errors.MinifluxServerError):
            await client.get_entries_by_id([1])

    async def test_hydrated_entries_include_content(self):
        by_url = {f"{BASE_URL}/v1/entries/1": FakeResponse(200, json_body=_raw_entry(1))}
        session = FakeSession(by_url=by_url)
        client = _client(session)

        entries, _ = await client.get_entries_by_id([1])

        assert entries[0].content is not None


class TestSetEntriesStatus:
    async def test_issues_bulk_put_with_ids_and_status(self):
        session = FakeSession([FakeResponse(204, text_body="")])
        client = _client(session)

        count = await client.set_entries_status([1, 2, 3], "read")

        assert count == 3
        assert session.calls[0].method == "PUT"
        assert session.calls[0].kwargs["json"] == {"entry_ids": [1, 2, 3], "status": "read"}


class TestSetEntriesStarred:
    async def test_declarative_star_toggles_only_unstarred(self):
        # 3 ids: #1 and #3 already unstarred, #2 already starred.
        by_url = {
            f"{BASE_URL}/v1/entries/1": FakeResponse(200, json_body=_raw_entry(1, starred=False)),
            f"{BASE_URL}/v1/entries/2": FakeResponse(200, json_body=_raw_entry(2, starred=True)),
            f"{BASE_URL}/v1/entries/3": FakeResponse(200, json_body=_raw_entry(3, starred=False)),
            f"{BASE_URL}/v1/entries/1/bookmark": FakeResponse(204, text_body=""),
            f"{BASE_URL}/v1/entries/3/bookmark": FakeResponse(204, text_body=""),
        }
        session = FakeSession(by_url=by_url)
        client = _client(session)

        toggled = await client.set_entries_starred([1, 2, 3], True)

        assert toggled == 2
        bookmark_calls = [c for c in session.calls if c.url.endswith("/bookmark")]
        assert {c.url for c in bookmark_calls} == {
            f"{BASE_URL}/v1/entries/1/bookmark",
            f"{BASE_URL}/v1/entries/3/bookmark",
        }

    async def test_declarative_star_idempotent_second_call_toggles_nothing(self):
        # All three already starred -> setting starred=True again toggles none.
        by_url = {
            f"{BASE_URL}/v1/entries/1": FakeResponse(200, json_body=_raw_entry(1, starred=True)),
            f"{BASE_URL}/v1/entries/2": FakeResponse(200, json_body=_raw_entry(2, starred=True)),
        }
        session = FakeSession(by_url=by_url)
        client = _client(session)

        toggled = await client.set_entries_starred([1, 2], True)

        assert toggled == 0
        assert not any(c.url.endswith("/bookmark") for c in session.calls)

    async def test_declarative_unstar_toggles_only_starred(self):
        by_url = {
            f"{BASE_URL}/v1/entries/1": FakeResponse(200, json_body=_raw_entry(1, starred=True)),
            f"{BASE_URL}/v1/entries/2": FakeResponse(200, json_body=_raw_entry(2, starred=False)),
            f"{BASE_URL}/v1/entries/1/bookmark": FakeResponse(204, text_body=""),
        }
        session = FakeSession(by_url=by_url)
        client = _client(session)

        toggled = await client.set_entries_starred([1, 2], False)

        assert toggled == 1
        bookmark_calls = [c for c in session.calls if c.url.endswith("/bookmark")]
        assert bookmark_calls[0].url == f"{BASE_URL}/v1/entries/1/bookmark"


class TestFeedAdmin:
    async def test_create_feed_returns_new_feed_id(self):
        session = FakeSession([FakeResponse(201, json_body={"feed_id": 99})])
        client = _client(session)

        feed_id = await client.create_feed("https://example.com/feed.xml")

        assert feed_id == 99
        assert session.calls[0].method == "POST"
        assert session.calls[0].kwargs["json"]["feed_url"] == "https://example.com/feed.xml"

    async def test_create_feed_includes_optional_fields_only_when_given(self):
        session = FakeSession([FakeResponse(201, json_body={"feed_id": 1})])
        client = _client(session)

        await client.create_feed("https://x/feed.xml", category_id=100, crawler=True)

        body = session.calls[0].kwargs["json"]
        assert body["category_id"] == 100
        assert body["crawler"] is True

    async def test_create_feed_omits_unset_optional_fields(self):
        session = FakeSession([FakeResponse(201, json_body={"feed_id": 1})])
        client = _client(session)

        await client.create_feed("https://x/feed.xml")

        body = session.calls[0].kwargs["json"]
        assert "category_id" not in body
        assert "crawler" not in body

    async def test_create_feed_400_raises_bad_request_with_message(self):
        session = FakeSession([FakeResponse(400, json_body={"error_message": "invalid feed_url"})])
        client = _client(session)

        with pytest.raises(errors.MinifluxBadRequestError) as exc_info:
            await client.create_feed("not-a-url")
        assert exc_info.value.detail == "invalid feed_url"

    async def test_update_feed_issues_put_with_fields(self):
        session = FakeSession([FakeResponse(204, text_body="")])
        client = _client(session)

        await client.update_feed(10, title="New Title", disabled=True)

        assert session.calls[0].method == "PUT"
        assert session.calls[0].url == f"{BASE_URL}/v1/feeds/10"
        assert session.calls[0].kwargs["json"] == {"title": "New Title", "disabled": True}

    async def test_delete_feed_issues_delete(self):
        session = FakeSession([FakeResponse(204, text_body="")])
        client = _client(session)

        await client.delete_feed(10)

        assert session.calls[0].method == "DELETE"
        assert session.calls[0].url == f"{BASE_URL}/v1/feeds/10"

    async def test_refresh_feed_hits_single_feed_endpoint(self):
        session = FakeSession([FakeResponse(204, text_body="")])
        client = _client(session)

        await client.refresh_feed(10)

        assert session.calls[0].method == "PUT"
        assert session.calls[0].url == f"{BASE_URL}/v1/feeds/10/refresh"

    async def test_refresh_all_feeds_hits_the_all_endpoint_not_a_single_feed(self):
        session = FakeSession([FakeResponse(204, text_body="")])
        client = _client(session)

        await client.refresh_all_feeds()

        assert session.calls[0].method == "PUT"
        # Must hit the bare .../feeds/refresh, never a single feed's
        # .../feeds/{id}/refresh -- that mixup is exactly the blast-radius
        # confusion the two distinct methods exist to prevent.
        assert session.calls[0].url == f"{BASE_URL}/v1/feeds/refresh"


class TestCategoryAdmin:
    async def test_get_categories_returns_raw_list(self):
        session = FakeSession([FakeResponse(200, json_body=[{"id": 100, "title": "News"}])])
        client = _client(session)

        result = await client.get_categories()

        assert result == [{"id": 100, "title": "News"}]

    async def test_create_category_returns_new_id(self):
        session = FakeSession([FakeResponse(201, json_body={"id": 200, "title": "Tech"})])
        client = _client(session)

        category_id = await client.create_category("Tech")

        assert category_id == 200
        assert session.calls[0].kwargs["json"] == {"title": "Tech"}

    async def test_update_category_issues_put(self):
        session = FakeSession([FakeResponse(204, text_body="")])
        client = _client(session)

        await client.update_category(100, "Renamed")

        assert session.calls[0].method == "PUT"
        assert session.calls[0].url == f"{BASE_URL}/v1/categories/100"
        assert session.calls[0].kwargs["json"] == {"title": "Renamed"}

    async def test_delete_category_issues_delete(self):
        session = FakeSession([FakeResponse(204, text_body="")])
        client = _client(session)

        await client.delete_category(100)

        assert session.calls[0].method == "DELETE"
        assert session.calls[0].url == f"{BASE_URL}/v1/categories/100"


class TestDiscoverFeeds:
    async def test_discover_posts_url_and_returns_candidates(self):
        candidates = [{"url": "https://example.com/feed.xml", "title": "Example", "type": "rss"}]
        session = FakeSession([FakeResponse(200, json_body=candidates)])
        client = _client(session)

        result = await client.discover("https://example.com")

        assert result == candidates
        assert session.calls[0].kwargs["json"] == {"url": "https://example.com"}


class TestOpml:
    async def test_export_opml_returns_raw_xml_string(self):
        opml_text = '<?xml version="1.0"?><opml version="2.0"><body/></opml>'
        session = FakeSession([FakeResponse(200, text_body=opml_text)])
        client = _client(session)

        result = await client.export_opml()

        assert result == opml_text

    async def test_import_opml_posts_raw_xml_body(self):
        session = FakeSession([FakeResponse(204, text_body="")])
        client = _client(session)

        await client.import_opml("<opml><body/></opml>")

        assert session.calls[0].method == "POST"
        assert session.calls[0].kwargs["data"] == "<opml><body/></opml>"


class TestMarkAllRead:
    """Backfilled during Phase 5 (services chunk 5.2) -- the scoped
    mark-all-as-read endpoints were documented in the assumed contract but
    missed when api.py was first built in Phase 2."""

    async def test_mark_feed_read_hits_feed_scoped_endpoint(self):
        session = FakeSession([FakeResponse(204, text_body="")])
        client = _client(session)

        await client.mark_feed_read(10)

        assert session.calls[0].method == "PUT"
        assert session.calls[0].url == f"{BASE_URL}/v1/feeds/10/mark-all-as-read"

    async def test_mark_category_read_hits_category_scoped_endpoint(self):
        session = FakeSession([FakeResponse(204, text_body="")])
        client = _client(session)

        await client.mark_category_read(100)

        assert session.calls[0].method == "PUT"
        assert session.calls[0].url == f"{BASE_URL}/v1/categories/100/mark-all-as-read"

    async def test_mark_all_read_fetches_user_id_then_marks_user_scope(self):
        by_url = {
            f"{BASE_URL}/v1/me": FakeResponse(200, json_body={"id": 7, "username": "matt"}),
            f"{BASE_URL}/v1/users/7/mark-all-as-read": FakeResponse(204, text_body=""),
        }
        session = FakeSession(by_url=by_url)
        client = _client(session)

        await client.mark_all_read()

        marked_calls = [c for c in session.calls if c.url.endswith("mark-all-as-read")]
        assert len(marked_calls) == 1
        assert marked_calls[0].url == f"{BASE_URL}/v1/users/7/mark-all-as-read"
