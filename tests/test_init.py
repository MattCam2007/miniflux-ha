"""Chunk 3.4 — __init__.py setup/unload/reload (architecture §1, D10).

Scoped to what Phase 3 owns: client + coordinator lifecycle. Platform
forwarding (Phase 4), service registration (Phase 5), and webhook
registration (Phase 6) are added to async_setup_entry incrementally as
those modules land -- see plans/04-config-and-coordinator.md's chunk 3.4
resolution note.

Goes through the real hass.config_entries.async_setup()/async_unload() flow
(not a bare call to async_setup_entry) so entry state transitions
(SETUP_RETRY, reauth-on-auth-failure) are exercised for real.
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from homeassistant.config_entries import SOURCE_REAUTH, ConfigEntryState
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.miniflux import errors
from custom_components.miniflux.const import (
    CONF_API_KEY,
    CONF_SCAN_INTERVAL,
    CONF_URL,
    CONF_VERIFY_SSL,
    CONF_WEBHOOK_ID,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
)


@contextmanager
def _patched_client(*, feeds=None, counters=None, starred=0, version=None, get_feeds_error=None):
    with (
        patch(
            "custom_components.miniflux.api.MinifluxClient.get_feeds",
            new=AsyncMock(
                return_value=feeds if feeds is not None else [], side_effect=get_feeds_error
            ),
        ),
        patch(
            "custom_components.miniflux.api.MinifluxClient.get_feed_counters",
            new=AsyncMock(return_value=counters or {"unreads": {}, "reads": {}}),
        ),
        patch(
            "custom_components.miniflux.api.MinifluxClient.count_entries",
            new=AsyncMock(return_value=starred),
        ),
        patch(
            "custom_components.miniflux.api.MinifluxClient.get_version",
            new=AsyncMock(return_value=version),
        ),
    ):
        yield


def _make_entry(hass) -> MockConfigEntry:
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


class TestSetup:
    async def test_healthy_setup_loads_entry_with_coordinator(self, hass):
        entry = _make_entry(hass)
        with _patched_client(feeds=[]):
            result = await hass.config_entries.async_setup(entry.entry_id)
            await hass.async_block_till_done()

        assert result is True
        assert entry.state is ConfigEntryState.LOADED
        assert entry.runtime_data.coordinator is not None
        assert entry.runtime_data.client is not None

    async def test_connection_error_sets_setup_retry(self, hass):
        entry = _make_entry(hass)
        with _patched_client(get_feeds_error=errors.MinifluxConnectionError("refused")):
            await hass.config_entries.async_setup(entry.entry_id)
            await hass.async_block_till_done()

        assert entry.state is ConfigEntryState.SETUP_RETRY

    async def test_auth_error_starts_reauth_flow(self, hass):
        entry = _make_entry(hass)
        with _patched_client(get_feeds_error=errors.MinifluxAuthError("bad key")):
            await hass.config_entries.async_setup(entry.entry_id)
            await hass.async_block_till_done()

        flows = hass.config_entries.flow.async_progress_by_handler(DOMAIN)
        assert any(f["context"]["source"] == SOURCE_REAUTH for f in flows)

    async def test_coordinator_picks_up_configured_scan_interval(self, hass):
        entry = _make_entry(hass)
        hass.config_entries.async_update_entry(entry, options={CONF_SCAN_INTERVAL: 600})
        with _patched_client(feeds=[]):
            await hass.config_entries.async_setup(entry.entry_id)
            await hass.async_block_till_done()

        assert entry.runtime_data.coordinator.update_interval == timedelta(seconds=600)

    async def test_default_scan_interval_when_unset(self, hass):
        entry = _make_entry(hass)
        with _patched_client(feeds=[]):
            await hass.config_entries.async_setup(entry.entry_id)
            await hass.async_block_till_done()

        assert entry.runtime_data.coordinator.update_interval == timedelta(
            seconds=DEFAULT_SCAN_INTERVAL
        )

    async def test_server_version_fetched_at_setup(self, hass):
        entry = _make_entry(hass)
        with _patched_client(feeds=[], version="2.1.0"):
            await hass.config_entries.async_setup(entry.entry_id)
            await hass.async_block_till_done()

        assert entry.runtime_data.coordinator.server_version == "2.1.0"


class TestUnload:
    async def test_unload_transitions_to_not_loaded(self, hass):
        entry = _make_entry(hass)
        with _patched_client(feeds=[]):
            await hass.config_entries.async_setup(entry.entry_id)
            await hass.async_block_till_done()

        result = await hass.config_entries.async_unload(entry.entry_id)
        await hass.async_block_till_done()

        assert result is True
        assert entry.state is ConfigEntryState.NOT_LOADED


class TestReload:
    async def test_options_update_triggers_reload_with_new_settings(self, hass):
        entry = _make_entry(hass)
        with _patched_client(feeds=[]):
            await hass.config_entries.async_setup(entry.entry_id)
            await hass.async_block_till_done()
            assert entry.runtime_data.coordinator.update_interval == timedelta(
                seconds=DEFAULT_SCAN_INTERVAL
            )

            hass.config_entries.async_update_entry(entry, options={CONF_SCAN_INTERVAL: 900})
            await hass.async_block_till_done()

        assert entry.runtime_data.coordinator.update_interval == timedelta(seconds=900)
