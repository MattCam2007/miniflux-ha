"""Chunks 3.4/4.x — __init__.py setup/unload/reload, now including platform
forwarding (architecture §1, D10).

Service registration (Phase 5) and webhook registration (Phase 6) are added
to async_setup_entry incrementally as those modules land -- see
plans/04-config-and-coordinator.md's chunk 3.4 resolution note.

Goes through the real hass.config_entries.async_setup()/async_unload() flow
(not a bare call to async_setup_entry) so entry state transitions
(SETUP_RETRY, reauth-on-auth-failure) and entity forwarding are exercised
for real.
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from homeassistant.config_entries import SOURCE_REAUTH, ConfigEntryState
from homeassistant.const import STATE_UNAVAILABLE
from homeassistant.setup import async_setup_component
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

    async def test_setup_registers_services(self, hass):
        from custom_components.miniflux.const import DOMAIN, SERVICE_SEARCH_ENTRIES

        entry = _make_entry(hass)
        with _patched_client(feeds=[]):
            await hass.config_entries.async_setup(entry.entry_id)
            await hass.async_block_till_done()

        assert hass.services.has_service(DOMAIN, SERVICE_SEARCH_ENTRIES)

    async def test_setup_forwards_sensor_and_binary_sensor_platforms(self, hass):
        entry = _make_entry(hass)
        with _patched_client(feeds=[]):
            await hass.config_entries.async_setup(entry.entry_id)
            await hass.async_block_till_done()

        entity_ids = set(hass.states.async_entity_ids())
        assert any(e.startswith("sensor.") for e in entity_ids)
        assert any(e.startswith("binary_sensor.") for e in entity_ids)
        # Exactly the four entities from Phase 4, no more.
        sensor_ids = {e for e in entity_ids if e.startswith(("sensor.", "binary_sensor."))}
        assert len(sensor_ids) == 4
        assert entry.runtime_data.client is not None

    async def test_entity_ids_match_the_ones_documented_in_setup_md(self, hass):
        """Phase 8: strings.json gives each entity's translation_key a real
        name, which is what has_entity_name entities slugify their entity_id
        from. This is the end-to-end check that docs/setup.md's documented
        entity_ids (sensor.miniflux_unread_entries et al.) are what setup
        actually produces, not just that strings.json parses."""
        entry = _make_entry(hass)
        with _patched_client(feeds=[]):
            await hass.config_entries.async_setup(entry.entry_id)
            await hass.async_block_till_done()

        assert hass.states.get("sensor.miniflux_unread_entries") is not None
        assert hass.states.get("sensor.miniflux_starred_entries") is not None
        assert hass.states.get("sensor.miniflux_feeds_with_errors") is not None
        assert hass.states.get("binary_sensor.miniflux_reachable") is not None

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


class TestFrontendRegistration:
    """F-U1: async_setup_entry actually wires up frontend.async_register_frontend.

    Detailed branch coverage (YAML mode, no-lovelace, version bump) lives in
    tests/test_frontend.py; this class is the end-to-end wiring proof.
    """

    async def test_setup_registers_static_path_and_lovelace_resource(self, hass):
        from homeassistant.components.lovelace.const import LOVELACE_DATA

        await async_setup_component(hass, "http", {})
        await async_setup_component(hass, "lovelace", {})

        entry = _make_entry(hass)
        with _patched_client(feeds=[]):
            await hass.config_entries.async_setup(entry.entry_id)
            await hass.async_block_till_done()

        assert hass.data[DOMAIN]["frontend_static_path_registered"] is True
        items = hass.data[LOVELACE_DATA].resources.async_items()
        assert any(item["url"].startswith("/miniflux/frontend/miniflux-cards.js") for item in items)


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

    async def test_unload_marks_entities_unavailable(self, hass):
        """HA keeps a restored placeholder state after platform unload
        rather than deleting the state record outright -- the correct
        assertion is that no entity is left reporting stale live data,
        not that the state machine forgets the entity ever existed."""
        entry = _make_entry(hass)
        with _patched_client(feeds=[]):
            await hass.config_entries.async_setup(entry.entry_id)
            await hass.async_block_till_done()
            live_states = [
                hass.states.get(e)
                for e in hass.states.async_entity_ids()
                if e.startswith(("sensor.", "binary_sensor."))
            ]
            assert live_states and all(s.state != STATE_UNAVAILABLE for s in live_states)

            await hass.config_entries.async_unload(entry.entry_id)
            await hass.async_block_till_done()

        post_unload_states = [
            hass.states.get(e)
            for e in hass.states.async_entity_ids()
            if e.startswith(("sensor.", "binary_sensor."))
        ]
        assert post_unload_states
        assert all(s.state == STATE_UNAVAILABLE for s in post_unload_states)


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
