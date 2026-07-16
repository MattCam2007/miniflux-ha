"""The reachability binary sensor (architecture §3.6, D10).

The one entity whose availability is deliberately NOT tied to the
coordinator's last_update_success -- it overrides CoordinatorEntity's
default availability so it stays present and truthful during an outage,
which is the entire reason it exists: reporting degraded state, not
vanishing into it.
"""

from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .entity import MinifluxEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator = entry.runtime_data.coordinator
    async_add_entities([MinifluxReachableBinarySensor(coordinator)])


class MinifluxReachableBinarySensor(MinifluxEntity, BinarySensorEntity):
    _attr_translation_key = "reachable"
    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY

    def __init__(self, coordinator) -> None:
        super().__init__(coordinator, "reachable")

    @property
    def available(self) -> bool:
        # Deliberate override of CoordinatorEntity.available (which defaults
        # to last_update_success): see module docstring.
        return True

    @property
    def is_on(self) -> bool:
        return self.coordinator.last_update_success

    @property
    def extra_state_attributes(self) -> dict:
        coordinator = self.coordinator
        return {
            "last_success_at": (
                coordinator.last_success_at.isoformat() if coordinator.last_success_at else None
            ),
            "last_error": coordinator.last_error,
            "last_webhook_at": (
                coordinator.last_webhook_at.isoformat() if coordinator.last_webhook_at else None
            ),
            "server_version": coordinator.server_version,
        }
