"""Phase 5 — the service layer (architecture §3.3, §4).

Services validate (schema + pure filters) before any HTTP, dispatch to the
client, and shape responses via pure mappers -- these tests assert
validation-before-HTTP (client not called on bad input), correct dispatch,
exact response envelopes, and loud typed failures (D10).
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
import voluptuous as vol
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.miniflux import errors
from custom_components.miniflux.const import (
    DOMAIN,
    HYDRATE_IDS_MAX,
    SEARCH_LIMIT_MAX,
    SERVICE_COUNT_ENTRIES,
    SERVICE_CREATE_CATEGORY,
    SERVICE_CREATE_FEED,
    SERVICE_DELETE_CATEGORY,
    SERVICE_DELETE_FEED,
    SERVICE_DISCOVER_FEEDS,
    SERVICE_EXPORT_OPML,
    SERVICE_GET_ENTRIES,
    SERVICE_GET_FEEDS,
    SERVICE_IMPORT_OPML,
    SERVICE_MARK_ALL_READ,
    SERVICE_REFRESH_ALL_FEEDS,
    SERVICE_REFRESH_FEED,
    SERVICE_SEARCH_ENTRIES,
    SERVICE_UPDATE_CATEGORY,
    SERVICE_UPDATE_ENTRIES,
    SERVICE_UPDATE_FEED,
    UPDATE_IDS_MAX,
)
from custom_components.miniflux.services import _resolve_entry, _run, async_register_services

NOW = datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC)


class TestResolveEntry:
    def test_single_entry_no_id_resolves_it(self, hass, entry_with_client):
        resolved = _resolve_entry(hass, None)
        assert resolved.entry_id == entry_with_client.entry_id

    def test_two_entries_no_id_raises(self, hass, entry_with_client):
        second = MockConfigEntry(domain=DOMAIN, unique_id="other.example.lan:1", data={})
        second.add_to_hass(hass)

        with pytest.raises(ServiceValidationError):
            _resolve_entry(hass, None)

    def test_two_entries_with_valid_id_resolves(self, hass, entry_with_client):
        second = MockConfigEntry(domain=DOMAIN, unique_id="other.example.lan:1", data={})
        second.add_to_hass(hass)

        resolved = _resolve_entry(hass, second.entry_id)
        assert resolved.entry_id == second.entry_id

    def test_unknown_id_raises(self, hass, entry_with_client):
        with pytest.raises(ServiceValidationError):
            _resolve_entry(hass, "does-not-exist")

    def test_no_entries_at_all_raises(self, hass):
        with pytest.raises(ServiceValidationError):
            _resolve_entry(hass, None)


class TestRun:
    async def test_passes_through_successful_result(self):
        async def _ok():
            return {"total": 5}

        result = await _run(_ok())
        assert result == {"total": 5}

    async def test_wraps_connection_error_as_home_assistant_error(self):
        async def _fail():
            raise errors.MinifluxConnectionError("refused")

        with pytest.raises(HomeAssistantError) as exc_info:
            await _run(_fail())
        assert "unreachable" in str(exc_info.value).lower()
        assert not isinstance(exc_info.value, ServiceValidationError)

    async def test_auth_error_also_wrapped_as_home_assistant_error(self):
        """The service layer surfaces auth failures as call errors too --
        the reauth flow itself is triggered by the coordinator's own polling
        (Phase 3), not by a one-off service call."""

        async def _fail():
            raise errors.MinifluxAuthError("bad key")

        with pytest.raises(HomeAssistantError):
            await _run(_fail())


async def _call(hass, service, data, *, return_response=True, **kwargs):
    return await hass.services.async_call(
        DOMAIN, service, data, blocking=True, return_response=return_response, **kwargs
    )


class TestSearchEntries:
    async def test_maps_filters_and_returns_envelope(self, hass, entry_with_client, fake_client):
        fake_client.query_entries.return_value = (5, [])
        async_register_services(hass)

        result = await _call(hass, SERVICE_SEARCH_ENTRIES, {"category": 100, "status": "read"})

        assert result == {"total": 5, "count": 0, "entries": []}
        sent_params, sent_kwargs = fake_client.query_entries.call_args
        assert sent_params[0]["category_id"] == 100
        assert sent_params[0]["status"] == ["read"]

    async def test_invalid_filter_combo_raises_before_client_call(
        self, hass, entry_with_client, fake_client
    ):
        async_register_services(hass)
        with pytest.raises(ServiceValidationError):
            await _call(
                hass,
                SERVICE_SEARCH_ENTRIES,
                {"published_within": {"hours": 36}, "published_after": NOW.isoformat()},
            )
        fake_client.query_entries.assert_not_called()

    async def test_unknown_category_title_raises_before_client_call(
        self, hass, entry_with_client, fake_client
    ):
        async_register_services(hass)
        with pytest.raises(ServiceValidationError):
            await _call(hass, SERVICE_SEARCH_ENTRIES, {"category": "Nonexistent"})
        fake_client.query_entries.assert_not_called()

    async def test_naive_published_after_raises_service_validation_error(
        self, hass, entry_with_client, fake_client
    ):
        """cv.datetime allows a naive (offset-less) datetime through schema
        validation; the tz-aware requirement lives in timeutil and must
        still surface as a clean ServiceValidationError, not an unhandled
        TimeParseError."""
        async_register_services(hass)
        with pytest.raises(ServiceValidationError):
            await _call(
                hass, SERVICE_SEARCH_ENTRIES, {"published_after": "2026-07-14T20:00:00"}
            )
        fake_client.query_entries.assert_not_called()

    async def test_include_content_false_by_default_strips_content(
        self, hass, entry_with_client, fake_client, make_entry
    ):
        entry = make_entry(content="<p>full body</p>")
        fake_client.query_entries.return_value = (1, [entry])
        async_register_services(hass)

        result = await _call(hass, SERVICE_SEARCH_ENTRIES, {})

        assert "content" not in result["entries"][0]

    async def test_include_content_true_keeps_content(
        self, hass, entry_with_client, fake_client, make_entry
    ):
        entry = make_entry(content="<p>full body</p>")
        fake_client.query_entries.return_value = (1, [entry])
        async_register_services(hass)

        result = await _call(hass, SERVICE_SEARCH_ENTRIES, {"include_content": True})

        assert result["entries"][0]["content"] == "<p>full body</p>"

    async def test_limit_over_max_raises_before_client_call(
        self, hass, entry_with_client, fake_client
    ):
        # Schema-level rejection: HA's service-call machinery re-raises
        # vol.Invalid directly, it does not convert it to
        # ServiceValidationError (verified against the installed HA source).
        async_register_services(hass)
        with pytest.raises(vol.Invalid):
            await _call(hass, SERVICE_SEARCH_ENTRIES, {"limit": SEARCH_LIMIT_MAX + 1})
        fake_client.query_entries.assert_not_called()


class TestCountEntries:
    async def test_returns_total_only_calls_cheap_path(
        self, hass, entry_with_client, fake_client
    ):
        fake_client.count_entries.return_value = 42
        async_register_services(hass)

        result = await _call(hass, SERVICE_COUNT_ENTRIES, {"status": "unread"})

        assert result == {"total": 42}
        fake_client.query_entries.assert_not_called()


class TestGetEntries:
    async def test_deleted_id_lands_in_missing(
        self, hass, entry_with_client, fake_client, make_entry
    ):
        entry = make_entry(id=1)
        fake_client.get_entries_by_id.return_value = ([entry], [2])
        async_register_services(hass)

        result = await _call(hass, SERVICE_GET_ENTRIES, {"entry_ids": [1, 2]})

        assert result["missing"] == [2]
        assert [e["id"] for e in result["entries"]] == [1]

    async def test_over_max_ids_raises_before_client_call(
        self, hass, entry_with_client, fake_client
    ):
        async_register_services(hass)
        with pytest.raises(ServiceValidationError):
            await _call(
                hass, SERVICE_GET_ENTRIES, {"entry_ids": list(range(HYDRATE_IDS_MAX + 1))}
            )
        fake_client.get_entries_by_id.assert_not_called()

    async def test_include_content_defaults_true(
        self, hass, entry_with_client, fake_client, make_entry
    ):
        entry = make_entry(id=1, content="<p>body</p>")
        fake_client.get_entries_by_id.return_value = ([entry], [])
        async_register_services(hass)

        result = await _call(hass, SERVICE_GET_ENTRIES, {"entry_ids": [1]})

        assert result["entries"][0]["content"] == "<p>body</p>"


class TestGetFeeds:
    async def test_only_with_errors_filters_to_error_feeds(
        self, hass, entry_with_client, fake_client, make_feed
    ):
        healthy = make_feed(id=1, parsing_error_count=0)
        errored = make_feed(id=2, parsing_error_count=3)
        fake_client.get_feeds.return_value = [healthy, errored]
        async_register_services(hass)

        result = await _call(hass, SERVICE_GET_FEEDS, {"only_with_errors": True})

        assert [f["id"] for f in result["feeds"]] == [2]

    async def test_no_filter_returns_all_feeds_live(
        self, hass, entry_with_client, fake_client, make_feed
    ):
        fake_client.get_feeds.return_value = [make_feed(id=1), make_feed(id=2)]
        async_register_services(hass)

        result = await _call(hass, SERVICE_GET_FEEDS, {})

        assert len(result["feeds"]) == 2
        fake_client.get_feeds.assert_called_once()

    async def test_category_id_filters_to_that_category(
        self, hass, entry_with_client, fake_client, make_feed
    ):
        in_cat = make_feed(id=1, category_id=100)
        other_cat = make_feed(id=2, category_id=200)
        fake_client.get_feeds.return_value = [in_cat, other_cat]
        async_register_services(hass)

        result = await _call(hass, SERVICE_GET_FEEDS, {"category": 100})

        assert [f["id"] for f in result["feeds"]] == [1]

    async def test_category_title_resolved_via_snapshot_and_filters(
        self, hass, entry_with_client, fake_client, coordinator, snapshot_factory, make_feed
    ):
        in_cat = make_feed(id=1, category_id=100, category_title="News")
        other_cat = make_feed(id=2, category_id=200, category_title="Tech")
        coordinator.data = snapshot_factory(feeds=(in_cat, other_cat))
        fake_client.get_feeds.return_value = [in_cat, other_cat]
        async_register_services(hass)

        result = await _call(hass, SERVICE_GET_FEEDS, {"category": "News"})

        assert [f["id"] for f in result["feeds"]] == [1]

    async def test_unknown_category_title_raises_before_client_call(
        self, hass, entry_with_client, fake_client
    ):
        async_register_services(hass)
        with pytest.raises(ServiceValidationError):
            await _call(hass, SERVICE_GET_FEEDS, {"category": "Nonexistent"})
        fake_client.get_feeds.assert_not_called()


class TestUpdateEntries:
    async def test_neither_status_nor_starred_raises(self, hass, entry_with_client, fake_client):
        async_register_services(hass)
        with pytest.raises(vol.Invalid):
            await _call(hass, SERVICE_UPDATE_ENTRIES, {"entry_ids": [1, 2]})
        fake_client.set_entries_status.assert_not_called()

    async def test_status_dispatches_and_requests_refresh(
        self, hass, entry_with_client, fake_client
    ):
        async_register_services(hass)

        result = await _call(
            hass, SERVICE_UPDATE_ENTRIES, {"entry_ids": [1, 2], "status": "read"}
        )

        fake_client.set_entries_status.assert_called_once_with([1, 2], "read")
        fake_client.set_entries_starred.assert_not_called()
        assert result == {"updated": 2}

    async def test_starred_dispatches_declarative_star(
        self, hass, entry_with_client, fake_client
    ):
        async_register_services(hass)

        await _call(hass, SERVICE_UPDATE_ENTRIES, {"entry_ids": [1, 2], "starred": True})

        fake_client.set_entries_starred.assert_called_once_with([1, 2], True)
        fake_client.set_entries_status.assert_not_called()

    async def test_both_status_and_starred_dispatches_both(
        self, hass, entry_with_client, fake_client
    ):
        async_register_services(hass)

        await _call(
            hass,
            SERVICE_UPDATE_ENTRIES,
            {"entry_ids": [1], "status": "read", "starred": True},
        )

        fake_client.set_entries_status.assert_called_once_with([1], "read")
        fake_client.set_entries_starred.assert_called_once_with([1], True)

    async def test_over_max_ids_raises_before_client_call(
        self, hass, entry_with_client, fake_client
    ):
        async_register_services(hass)
        with pytest.raises(ServiceValidationError):
            await _call(
                hass,
                SERVICE_UPDATE_ENTRIES,
                {"entry_ids": list(range(UPDATE_IDS_MAX + 1)), "status": "read"},
            )
        fake_client.set_entries_status.assert_not_called()


class TestMarkAllRead:
    """mark_all_read returns nothing, so every call here uses
    return_response=False -- HA's service registry checks
    return_response/supports_response *before* schema validation, so a
    stray return_response=True would fail every call with
    service_does_not_support_response before ever reaching the vol.Invalid
    these tests are actually checking for."""

    async def test_two_scope_args_raises(self, hass, entry_with_client, fake_client):
        async_register_services(hass)
        with pytest.raises(vol.Invalid):
            await _call(
                hass,
                SERVICE_MARK_ALL_READ,
                {"feed": 10, "category": 100},
                return_response=False,
            )
        fake_client.mark_feed_read.assert_not_called()

    async def test_no_scope_args_raises(self, hass, entry_with_client, fake_client):
        async_register_services(hass)
        with pytest.raises(vol.Invalid):
            await _call(hass, SERVICE_MARK_ALL_READ, {}, return_response=False)

    async def test_feed_scope_routes_to_feed_endpoint(self, hass, entry_with_client, fake_client):
        async_register_services(hass)

        await _call(hass, SERVICE_MARK_ALL_READ, {"feed": 10}, return_response=False)

        fake_client.mark_feed_read.assert_called_once_with(10)
        fake_client.mark_category_read.assert_not_called()
        fake_client.mark_all_read.assert_not_called()

    async def test_category_scope_routes_to_category_endpoint(
        self, hass, entry_with_client, fake_client
    ):
        async_register_services(hass)

        await _call(hass, SERVICE_MARK_ALL_READ, {"category": 100}, return_response=False)

        fake_client.mark_category_read.assert_called_once_with(100)
        fake_client.mark_feed_read.assert_not_called()

    async def test_everything_routes_to_user_scope(self, hass, entry_with_client, fake_client):
        async_register_services(hass)

        await _call(hass, SERVICE_MARK_ALL_READ, {"everything": True}, return_response=False)

        fake_client.mark_all_read.assert_called_once()
        fake_client.mark_feed_read.assert_not_called()
        fake_client.mark_category_read.assert_not_called()

    async def test_feed_title_resolved_via_snapshot(
        self, hass, entry_with_client, fake_client, coordinator, snapshot_factory, make_feed
    ):
        coordinator.data = snapshot_factory(feeds=(make_feed(id=42, title="My Blog"),))
        async_register_services(hass)

        await _call(hass, SERVICE_MARK_ALL_READ, {"feed": "My Blog"}, return_response=False)

        fake_client.mark_feed_read.assert_called_once_with(42)


class TestCreateFeed:
    async def test_missing_feed_url_raises(self, hass, entry_with_client, fake_client):
        # create_feed supports_response=ONLY, so it requires
        # return_response=True (the _call default) -- unlike the
        # None-response mutation services above.
        async_register_services(hass)
        with pytest.raises(vol.Invalid):
            await _call(hass, SERVICE_CREATE_FEED, {})
        fake_client.create_feed.assert_not_called()

    async def test_creates_and_returns_feed_id(self, hass, entry_with_client, fake_client):
        fake_client.create_feed.return_value = 99
        async_register_services(hass)

        result = await _call(hass, SERVICE_CREATE_FEED, {"feed_url": "https://x/feed.xml"})

        assert result == {"feed_id": 99}
        fake_client.create_feed.assert_called_once_with("https://x/feed.xml")

    async def test_category_and_crawler_passed_through(
        self, hass, entry_with_client, fake_client
    ):
        fake_client.create_feed.return_value = 1
        async_register_services(hass)

        await _call(
            hass,
            SERVICE_CREATE_FEED,
            {"feed_url": "https://x/feed.xml", "category": 100, "crawler": True},
        )

        fake_client.create_feed.assert_called_once_with(
            "https://x/feed.xml", category_id=100, crawler=True
        )


class TestUpdateFeed:
    async def test_requires_feed(self, hass, entry_with_client, fake_client):
        async_register_services(hass)
        with pytest.raises(vol.Invalid):
            await _call(hass, SERVICE_UPDATE_FEED, {"title": "New"}, return_response=False)

    async def test_title_resolved_via_snapshot_and_dispatched(
        self, hass, entry_with_client, fake_client, coordinator, snapshot_factory, make_feed
    ):
        coordinator.data = snapshot_factory(feeds=(make_feed(id=42, title="My Blog"),))
        async_register_services(hass)

        await _call(
            hass,
            SERVICE_UPDATE_FEED,
            {"feed": "My Blog", "title": "Renamed"},
            return_response=False,
        )

        fake_client.update_feed.assert_called_once_with(42, title="Renamed")

    async def test_unknown_feed_title_raises_before_client_call(
        self, hass, entry_with_client, fake_client
    ):
        async_register_services(hass)
        with pytest.raises(ServiceValidationError):
            await _call(
                hass,
                SERVICE_UPDATE_FEED,
                {"feed": "Nonexistent", "title": "x"},
                return_response=False,
            )
        fake_client.update_feed.assert_not_called()

    async def test_category_resolved_via_snapshot_and_dispatched(
        self, hass, entry_with_client, fake_client, coordinator, snapshot_factory, make_feed
    ):
        coordinator.data = snapshot_factory(
            feeds=(make_feed(id=42, category_id=100, category_title="News"),)
        )
        async_register_services(hass)

        await _call(
            hass,
            SERVICE_UPDATE_FEED,
            {"feed": 42, "category": "News"},
            return_response=False,
        )

        fake_client.update_feed.assert_called_once_with(42, category_id=100)

    async def test_unknown_category_title_raises_before_client_call(
        self, hass, entry_with_client, fake_client, coordinator, snapshot_factory, make_feed
    ):
        coordinator.data = snapshot_factory(feeds=(make_feed(id=42),))
        async_register_services(hass)

        with pytest.raises(ServiceValidationError):
            await _call(
                hass,
                SERVICE_UPDATE_FEED,
                {"feed": 42, "category": "Nonexistent"},
                return_response=False,
            )
        fake_client.update_feed.assert_not_called()

    async def test_feed_url_dispatched(self, hass, entry_with_client, fake_client):
        async_register_services(hass)

        await _call(
            hass,
            SERVICE_UPDATE_FEED,
            {"feed": 42, "feed_url": "https://new.example/feed.xml"},
            return_response=False,
        )

        fake_client.update_feed.assert_called_once_with(
            42, feed_url="https://new.example/feed.xml"
        )

    async def test_disabled_dispatched(self, hass, entry_with_client, fake_client):
        async_register_services(hass)

        await _call(
            hass,
            SERVICE_UPDATE_FEED,
            {"feed": 42, "disabled": True},
            return_response=False,
        )

        fake_client.update_feed.assert_called_once_with(42, disabled=True)

    async def test_crawler_dispatched(self, hass, entry_with_client, fake_client):
        async_register_services(hass)

        await _call(
            hass,
            SERVICE_UPDATE_FEED,
            {"feed": 42, "crawler": False},
            return_response=False,
        )

        fake_client.update_feed.assert_called_once_with(42, crawler=False)


class TestDeleteFeed:
    async def test_schema_requires_only_feed(self, hass, entry_with_client, fake_client):
        """delete_feed is its own service (not an action enum) -- its schema
        requires just `feed`, nothing else (§4 Rule 3)."""
        async_register_services(hass)
        with pytest.raises(vol.Invalid):
            await _call(hass, SERVICE_DELETE_FEED, {}, return_response=False)

    async def test_dispatches_delete(self, hass, entry_with_client, fake_client):
        async_register_services(hass)

        await _call(hass, SERVICE_DELETE_FEED, {"feed": 10}, return_response=False)

        fake_client.delete_feed.assert_called_once_with(10)


class TestRefreshFeed:
    async def test_requires_feed(self, hass, entry_with_client, fake_client):
        async_register_services(hass)
        with pytest.raises(vol.Invalid):
            await _call(hass, SERVICE_REFRESH_FEED, {}, return_response=False)

    async def test_dispatches_single_feed_refresh(self, hass, entry_with_client, fake_client):
        async_register_services(hass)

        await _call(hass, SERVICE_REFRESH_FEED, {"feed": 10}, return_response=False)

        fake_client.refresh_feed.assert_called_once_with(10)
        fake_client.refresh_all_feeds.assert_not_called()


class TestRefreshAllFeeds:
    async def test_takes_no_feed_argument_hits_all_endpoint(
        self, hass, entry_with_client, fake_client
    ):
        """refresh_feed and refresh_all_feeds can never be confused: this
        service's schema has no `feed` field at all."""
        async_register_services(hass)

        await _call(hass, SERVICE_REFRESH_ALL_FEEDS, {}, return_response=False)

        fake_client.refresh_all_feeds.assert_called_once()
        fake_client.refresh_feed.assert_not_called()


class TestOptionalTierAdminServices:
    """discover_feeds, category CRUD, OPML -- fully implemented (Phase 2's
    api.py has real methods behind all of these), given a lighter test pass
    than the core five since there's no new validation shape to prove."""

    async def test_discover_feeds_returns_candidates(self, hass, entry_with_client, fake_client):
        candidates = [{"url": "https://x/feed.xml", "title": "X", "type": "rss"}]
        fake_client.discover.return_value = candidates
        async_register_services(hass)

        result = await _call(hass, SERVICE_DISCOVER_FEEDS, {"url": "https://x"})

        assert result == {"feeds": candidates}
        fake_client.discover.assert_called_once_with("https://x")

    async def test_create_category_returns_id(self, hass, entry_with_client, fake_client):
        fake_client.create_category.return_value = 200
        async_register_services(hass)

        result = await _call(hass, SERVICE_CREATE_CATEGORY, {"title": "Tech"})

        assert result == {"category_id": 200}

    async def test_update_category_resolves_title_and_dispatches(
        self, hass, entry_with_client, fake_client, coordinator, snapshot_factory, make_feed
    ):
        coordinator.data = snapshot_factory(
            feeds=(make_feed(id=1, category_id=100, category_title="News"),)
        )
        async_register_services(hass)

        await _call(
            hass,
            SERVICE_UPDATE_CATEGORY,
            {"category": "News", "title": "World News"},
            return_response=False,
        )

        fake_client.update_category.assert_called_once_with(100, "World News")

    async def test_delete_category_dispatches(self, hass, entry_with_client, fake_client):
        async_register_services(hass)

        await _call(hass, SERVICE_DELETE_CATEGORY, {"category": 100}, return_response=False)

        fake_client.delete_category.assert_called_once_with(100)

    async def test_export_opml_returns_raw_string(self, hass, entry_with_client, fake_client):
        fake_client.export_opml.return_value = "<opml><body/></opml>"
        async_register_services(hass)

        result = await _call(hass, SERVICE_EXPORT_OPML, {})

        assert result == {"opml": "<opml><body/></opml>"}

    async def test_import_opml_dispatches_raw_string(self, hass, entry_with_client, fake_client):
        async_register_services(hass)

        await _call(
            hass, SERVICE_IMPORT_OPML, {"opml": "<opml/>"}, return_response=False
        )

        fake_client.import_opml.assert_called_once_with("<opml/>")


class TestServiceRegistrationIdempotent:
    def test_calling_twice_does_not_error_or_duplicate(self, hass, entry_with_client):
        async_register_services(hass)
        async_register_services(hass)  # must not raise
        assert hass.services.has_service(DOMAIN, SERVICE_SEARCH_ENTRIES)
