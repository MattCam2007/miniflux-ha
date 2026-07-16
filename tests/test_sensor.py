"""Chunks 4.2/4.3/4.4 — unread, starred, feeds-with-errors sensors.

Pure projections over an injected snapshot (architecture §3.6, D3: aggregate
entities with capped attributes, not per-feed/per-category entities).
"""

from __future__ import annotations

from custom_components.miniflux.const import BY_CATEGORY_ATTR_CAP, ERROR_FEEDS_ATTR_CAP
from custom_components.miniflux.models import CategoryUnread
from custom_components.miniflux.sensor import (
    MinifluxFeedsWithErrorsSensor,
    MinifluxStarredSensor,
    MinifluxUnreadSensor,
)


class TestUnreadSensor:
    def test_state_equals_unread_total(self, coordinator, snapshot_factory):
        coordinator.data = snapshot_factory(unread_total=42)
        sensor = MinifluxUnreadSensor(coordinator)
        assert sensor.native_value == 42

    def test_by_category_attribute_mirrors_rollup(self, coordinator, snapshot_factory):
        categories = (CategoryUnread(id=100, title="News", unread=5),)
        coordinator.data = snapshot_factory(unread_total=5, unread_by_category=categories)
        sensor = MinifluxUnreadSensor(coordinator)
        assert sensor.extra_state_attributes["by_category"] == [
            {"id": 100, "title": "News", "unread": 5}
        ]

    def test_by_category_capped(self, coordinator, snapshot_factory):
        over_cap = BY_CATEGORY_ATTR_CAP + 10
        categories = tuple(
            CategoryUnread(id=i, title=f"Cat{i}", unread=1) for i in range(over_cap)
        )
        coordinator.data = snapshot_factory(unread_by_category=categories)
        sensor = MinifluxUnreadSensor(coordinator)
        assert len(sensor.extra_state_attributes["by_category"]) == BY_CATEGORY_ATTR_CAP

    def test_state_class_is_measurement(self, coordinator, snapshot_factory):
        coordinator.data = snapshot_factory()
        sensor = MinifluxUnreadSensor(coordinator)
        assert sensor.state_class == "measurement"


class TestStarredSensor:
    def test_state_equals_starred_total(self, coordinator, snapshot_factory):
        coordinator.data = snapshot_factory(starred_total=7)
        sensor = MinifluxStarredSensor(coordinator)
        assert sensor.native_value == 7

    def test_state_updates_when_snapshot_changes(self, coordinator, snapshot_factory):
        coordinator.data = snapshot_factory(starred_total=1)
        sensor = MinifluxStarredSensor(coordinator)
        assert sensor.native_value == 1

        coordinator.data = snapshot_factory(starred_total=9)
        assert sensor.native_value == 9


class TestFeedsWithErrorsSensor:
    def test_state_equals_error_feed_count(self, coordinator, snapshot_factory, make_feed):
        errored = (make_feed(id=1, parsing_error_count=3),)
        coordinator.data = snapshot_factory(error_feeds=errored)
        sensor = MinifluxFeedsWithErrorsSensor(coordinator)
        assert sensor.native_value == 1

    def test_feeds_attribute_lists_error_feeds(self, coordinator, snapshot_factory, make_feed):
        errored = make_feed(
            id=1,
            title="Broken",
            category_title="News",
            parsing_error_count=5,
            parsing_error_message="boom",
        )
        coordinator.data = snapshot_factory(error_feeds=(errored,))
        sensor = MinifluxFeedsWithErrorsSensor(coordinator)
        feeds_attr = sensor.extra_state_attributes["feeds"]
        assert len(feeds_attr) == 1
        assert feeds_attr[0]["id"] == 1
        assert feeds_attr[0]["title"] == "Broken"
        assert feeds_attr[0]["category_title"] == "News"
        assert feeds_attr[0]["parsing_error_count"] == 5
        assert feeds_attr[0]["parsing_error_message"] == "boom"

    def test_zero_errors_empty_list_not_truncated(self, coordinator, snapshot_factory):
        coordinator.data = snapshot_factory(error_feeds=())
        sensor = MinifluxFeedsWithErrorsSensor(coordinator)
        assert sensor.native_value == 0
        assert sensor.extra_state_attributes["feeds"] == []
        assert sensor.extra_state_attributes["truncated"] is False

    def test_over_cap_truncated_flag_set(self, coordinator, snapshot_factory, make_feed):
        errored = tuple(
            make_feed(id=i, parsing_error_count=1) for i in range(ERROR_FEEDS_ATTR_CAP + 5)
        )
        coordinator.data = snapshot_factory(error_feeds=errored)
        sensor = MinifluxFeedsWithErrorsSensor(coordinator)
        assert len(sensor.extra_state_attributes["feeds"]) == ERROR_FEEDS_ATTR_CAP
        assert sensor.extra_state_attributes["truncated"] is True

    def test_total_feeds_reflects_full_feed_list(self, coordinator, snapshot_factory, make_feed):
        all_feeds = tuple(make_feed(id=i) for i in range(5))
        coordinator.data = snapshot_factory(feeds=all_feeds, error_feeds=())
        sensor = MinifluxFeedsWithErrorsSensor(coordinator)
        assert sensor.extra_state_attributes["total_feeds"] == 5
