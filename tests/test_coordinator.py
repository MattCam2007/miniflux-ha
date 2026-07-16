"""Chunk 3.5 — the polling coordinator (architecture §2.3, D4).

Uses async_refresh()/_async_update_data() directly rather than
async_config_entry_first_refresh() (which requires the config entry to be in
SETUP_IN_PROGRESS state, an integration-level concern that belongs to
__init__.py's own tests, chunk 3.4) -- these are coordinator-level tests.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.update_coordinator import UpdateFailed
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.miniflux import errors
from custom_components.miniflux.const import (
    CONF_API_KEY,
    CONF_URL,
    CONF_VERIFY_SSL,
    CONF_WEBHOOK_ID,
    DOMAIN,
    EVENT_FEED_ERROR,
    EVENT_FEED_RECOVERED,
)
from custom_components.miniflux.coordinator import MinifluxCoordinator
from custom_components.miniflux.models import Feed

INTERVAL = timedelta(seconds=300)


@pytest.fixture
def config_entry(hass):
    entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id="reader.example.lan:1",
        data={
            CONF_URL: "https://reader.example.lan",
            CONF_API_KEY: "test-key",
            CONF_VERIFY_SSL: True,
            CONF_WEBHOOK_ID: "webhook-id",
        },
    )
    entry.add_to_hass(hass)
    return entry


def _feed(**overrides) -> Feed:
    fields = dict(
        id=10,
        title="Feed",
        site_url="https://x",
        feed_url="https://x/feed.xml",
        category_id=100,
        category_title="News",
        checked_at=datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC),
        parsing_error_count=0,
        parsing_error_message="",
        disabled=False,
    )
    fields.update(overrides)
    return Feed(**fields)


def _wire_healthy(fake_client, feeds=None, unreads=None, starred=0):
    fake_client.get_feeds.return_value = feeds if feeds is not None else [_feed()]
    fake_client.get_feed_counters.return_value = {"unreads": unreads or {}, "reads": {}}
    fake_client.count_entries.return_value = starred


class TestUpdateData:
    async def test_successful_cycle_produces_valid_snapshot(
        self, hass, config_entry, fake_client
    ):
        _wire_healthy(fake_client, feeds=[_feed(id=10)], unreads={10: 5}, starred=3)
        coordinator = MinifluxCoordinator(hass, config_entry, fake_client, INTERVAL)

        await coordinator.async_refresh()

        assert coordinator.data.unread_total == 5
        assert coordinator.data.starred_total == 3
        assert coordinator.last_update_success is True

    async def test_first_cycle_fires_no_transition_events(
        self, hass, config_entry, fake_client
    ):
        _wire_healthy(fake_client)
        coordinator = MinifluxCoordinator(hass, config_entry, fake_client, INTERVAL)
        events = []
        hass.bus.async_listen(EVENT_FEED_ERROR, events.append)
        hass.bus.async_listen(EVENT_FEED_RECOVERED, events.append)

        await coordinator.async_refresh()
        await hass.async_block_till_done()

        assert events == []

    async def test_second_cycle_with_new_error_fires_feed_error_event(
        self, hass, config_entry, fake_client
    ):
        _wire_healthy(fake_client, feeds=[_feed(id=10, parsing_error_count=0)])
        coordinator = MinifluxCoordinator(hass, config_entry, fake_client, INTERVAL)
        await coordinator.async_refresh()  # baseline, fires nothing

        events = []
        hass.bus.async_listen(EVENT_FEED_ERROR, events.append)
        fake_client.get_feeds.return_value = [
            _feed(id=10, parsing_error_count=3, parsing_error_message="boom")
        ]

        await coordinator.async_refresh()
        await hass.async_block_till_done()

        assert len(events) == 1
        assert events[0].data["feed"]["id"] == 10
        assert events[0].data["parsing_error_count"] == 3
        assert events[0].data["config_entry_id"] == config_entry.entry_id
        assert events[0].data["instance_url"] == "https://reader.example.lan"

    async def test_recovery_cycle_fires_feed_recovered_event(
        self, hass, config_entry, fake_client
    ):
        _wire_healthy(fake_client, feeds=[_feed(id=10, parsing_error_count=3)])
        coordinator = MinifluxCoordinator(hass, config_entry, fake_client, INTERVAL)
        await coordinator.async_refresh()  # baseline: already erroring, fires nothing

        events = []
        hass.bus.async_listen(EVENT_FEED_RECOVERED, events.append)
        fake_client.get_feeds.return_value = [_feed(id=10, parsing_error_count=0)]

        await coordinator.async_refresh()
        await hass.async_block_till_done()

        assert len(events) == 1
        assert events[0].data["feed"]["id"] == 10

    async def test_auth_error_raises_config_entry_auth_failed(
        self, hass, config_entry, fake_client
    ):
        _wire_healthy(fake_client)
        fake_client.get_feeds.side_effect = errors.MinifluxAuthError("bad key")
        coordinator = MinifluxCoordinator(hass, config_entry, fake_client, INTERVAL)

        with pytest.raises(ConfigEntryAuthFailed):
            await coordinator._async_update_data()

    async def test_connection_error_raises_update_failed(
        self, hass, config_entry, fake_client
    ):
        _wire_healthy(fake_client)
        fake_client.get_feeds.side_effect = errors.MinifluxConnectionError("refused")
        coordinator = MinifluxCoordinator(hass, config_entry, fake_client, INTERVAL)

        with pytest.raises(UpdateFailed):
            await coordinator._async_update_data()

    async def test_successful_cycle_updates_last_success_at(
        self, hass, config_entry, fake_client
    ):
        _wire_healthy(fake_client)
        coordinator = MinifluxCoordinator(hass, config_entry, fake_client, INTERVAL)
        assert coordinator.last_success_at is None

        await coordinator.async_refresh()

        assert coordinator.last_success_at is not None


class TestDebounce:
    async def test_rapid_refresh_requests_coalesce(self, hass, config_entry, fake_client):
        _wire_healthy(fake_client)
        coordinator = MinifluxCoordinator(hass, config_entry, fake_client, INTERVAL)
        await coordinator.async_refresh()
        assert fake_client.get_feeds.call_count == 1

        await coordinator.async_request_refresh()
        await coordinator.async_request_refresh()
        await hass.async_block_till_done()

        # Two rapid requests inside the debounce window must coalesce into
        # exactly one additional fetch, not two.
        assert fake_client.get_feeds.call_count == 2


class TestFetchServerVersion:
    async def test_success_sets_server_version(self, hass, config_entry, fake_client):
        fake_client.get_version.return_value = "2.1.0"
        coordinator = MinifluxCoordinator(hass, config_entry, fake_client, INTERVAL)

        await coordinator.async_fetch_server_version()

        assert coordinator.server_version == "2.1.0"

    async def test_failure_does_not_raise_leaves_version_none(
        self, hass, config_entry, fake_client
    ):
        fake_client.get_version.side_effect = errors.MinifluxConnectionError("refused")
        coordinator = MinifluxCoordinator(hass, config_entry, fake_client, INTERVAL)

        await coordinator.async_fetch_server_version()  # must not raise

        assert coordinator.server_version is None


class TestNoteWebhook:
    async def test_updates_last_webhook_at_and_requests_refresh(
        self, hass, config_entry, fake_client
    ):
        _wire_healthy(fake_client)
        coordinator = MinifluxCoordinator(hass, config_entry, fake_client, INTERVAL)
        await coordinator.async_refresh()
        assert coordinator.last_webhook_at is None

        await coordinator.note_webhook()
        await hass.async_block_till_done()

        assert coordinator.last_webhook_at is not None
        assert fake_client.get_feeds.call_count == 2
