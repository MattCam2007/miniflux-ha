"""Shared entity base + device info (architecture §3.6).

One HA device per config entry represents the Miniflux instance. Entities
are pure projections over coordinator.data (seam rule 1) -- none of them
ever touch the API client directly.
"""

from __future__ import annotations

from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CONF_URL, DOMAIN
from .coordinator import MinifluxCoordinator


class MinifluxEntity(CoordinatorEntity[MinifluxCoordinator]):
    _attr_has_entity_name = True

    def __init__(self, coordinator: MinifluxCoordinator, key: str) -> None:
        super().__init__(coordinator)
        entry = coordinator.config_entry
        self._attr_unique_id = f"{entry.unique_id}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.unique_id)},
            name="Miniflux",
            configuration_url=entry.data[CONF_URL],
            manufacturer="Miniflux",
            sw_version=coordinator.server_version,
        )
