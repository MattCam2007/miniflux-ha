"""The Miniflux integration: entry setup/unload/reload (architecture §1
component map, D10).

Client + coordinator lifecycle (Phase 3) and platform forwarding (Phase 4).
Service registration and webhook registration are added here incrementally
by Phases 5/6 as those modules land -- each phase's own tests cover its
addition; this module's own tests only cover what's built so far.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import MinifluxClient
from .const import (
    CONF_API_KEY,
    CONF_SCAN_INTERVAL,
    CONF_URL,
    CONF_VERIFY_SSL,
    DEFAULT_SCAN_INTERVAL,
)
from .coordinator import MinifluxCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.SENSOR, Platform.BINARY_SENSOR]


@dataclass
class MinifluxRuntimeData:
    client: MinifluxClient
    coordinator: MinifluxCoordinator


type MinifluxConfigEntry = ConfigEntry[MinifluxRuntimeData]


async def async_setup_entry(hass: HomeAssistant, entry: MinifluxConfigEntry) -> bool:
    verify_ssl = entry.data[CONF_VERIFY_SSL]
    session = async_get_clientsession(hass, verify_ssl=verify_ssl)
    client = MinifluxClient(
        session, entry.data[CONF_URL], entry.data[CONF_API_KEY], verify_ssl=verify_ssl
    )

    scan_interval = entry.options.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)
    coordinator = MinifluxCoordinator(hass, entry, client, timedelta(seconds=scan_interval))

    # Raises ConfigEntryNotReady on connectivity/server failure, or lets
    # ConfigEntryAuthFailed propagate (both handled by HA's own entry-setup
    # machinery -- retry, or start reauth -- D10). No try/except needed here.
    await coordinator.async_config_entry_first_refresh()
    await coordinator.async_fetch_server_version()

    entry.runtime_data = MinifluxRuntimeData(client=client, coordinator=coordinator)
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: MinifluxConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def _async_update_listener(hass: HomeAssistant, entry: MinifluxConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
