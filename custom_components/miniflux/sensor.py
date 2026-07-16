"""The three content sensors (architecture §3.6, D3): pure projections over
coordinator.data. Aggregate entities with capped attributes, not per-feed
or per-category entities -- see architecture D3 for the cardinality
rationale.
"""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import BY_CATEGORY_ATTR_CAP, ERROR_FEEDS_ATTR_CAP
from .entity import MinifluxEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator = entry.runtime_data.coordinator
    async_add_entities(
        [
            MinifluxUnreadSensor(coordinator),
            MinifluxStarredSensor(coordinator),
            MinifluxFeedsWithErrorsSensor(coordinator),
        ]
    )


class MinifluxUnreadSensor(MinifluxEntity, SensorEntity):
    """Primary pipeline-depth signal; per-category breakdown as an
    attribute, not separate entities (D3)."""

    _attr_translation_key = "unread_entries"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator) -> None:
        super().__init__(coordinator, "unread_entries")

    @property
    def native_value(self) -> int:
        return self.coordinator.data.unread_total

    @property
    def extra_state_attributes(self) -> dict:
        capped = self.coordinator.data.unread_by_category[:BY_CATEGORY_ATTR_CAP]
        return {
            "by_category": [
                {"id": category.id, "title": category.title, "unread": category.unread}
                for category in capped
            ]
        }


class MinifluxStarredSensor(MinifluxEntity, SensorEntity):
    """Human-flagged queue depth -- the queryable engagement surface."""

    _attr_translation_key = "starred_entries"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator) -> None:
        super().__init__(coordinator, "starred_entries")

    @property
    def native_value(self) -> int:
        return self.coordinator.data.starred_total


class MinifluxFeedsWithErrorsSensor(MinifluxEntity, SensorEntity):
    """Makes a broken feed visible instead of silently stale. Count as
    state, details as a capped attribute (D3 -- one sensor, not per-feed
    entities)."""

    _attr_translation_key = "feeds_with_errors"

    def __init__(self, coordinator) -> None:
        super().__init__(coordinator, "feeds_with_errors")

    @property
    def native_value(self) -> int:
        return len(self.coordinator.data.error_feeds)

    @property
    def extra_state_attributes(self) -> dict:
        snapshot = self.coordinator.data
        error_feeds = snapshot.error_feeds
        capped = error_feeds[:ERROR_FEEDS_ATTR_CAP]
        return {
            "feeds": [
                {
                    "id": feed.id,
                    "title": feed.title,
                    "category_title": feed.category_title,
                    "parsing_error_count": feed.parsing_error_count,
                    "parsing_error_message": feed.parsing_error_message,
                    "checked_at": feed.checked_at.isoformat() if feed.checked_at else None,
                }
                for feed in capped
            ],
            "truncated": len(error_feeds) > ERROR_FEEDS_ATTR_CAP,
            "total_feeds": len(snapshot.feeds),
        }
