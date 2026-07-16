"""Chunk 4.5 — the reachability binary sensor (architecture §3.6, D10).

The whole reason this entity exists: it overrides CoordinatorEntity's
default availability (which tracks last_update_success) so it stays present
and truthful *during* an outage, while the content sensors correctly go
unavailable. Testing that asymmetry directly is the acceptance test for
"degraded states are visible" (D10).
"""

from __future__ import annotations

from datetime import UTC, datetime

from custom_components.miniflux.binary_sensor import MinifluxReachableBinarySensor
from custom_components.miniflux.sensor import MinifluxUnreadSensor

NOW = datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC)


class TestReachableState:
    def test_successful_coordinator_is_on(self, coordinator, snapshot_factory):
        coordinator.data = snapshot_factory()
        coordinator.last_update_success = True
        sensor = MinifluxReachableBinarySensor(coordinator)
        assert sensor.is_on is True

    def test_failed_coordinator_is_off(self, coordinator, snapshot_factory):
        coordinator.data = snapshot_factory()
        coordinator.last_update_success = False
        sensor = MinifluxReachableBinarySensor(coordinator)
        assert sensor.is_on is False

    def test_device_class_is_connectivity(self, coordinator, snapshot_factory):
        coordinator.data = snapshot_factory()
        sensor = MinifluxReachableBinarySensor(coordinator)
        assert sensor.device_class == "connectivity"


class TestAvailabilityOverride:
    def test_available_when_coordinator_healthy(self, coordinator, snapshot_factory):
        coordinator.data = snapshot_factory()
        coordinator.last_update_success = True
        sensor = MinifluxReachableBinarySensor(coordinator)
        assert sensor.available is True

    def test_still_available_when_coordinator_update_failed(self, coordinator, snapshot_factory):
        """The headline behavior: this sensor must NOT go unavailable just
        because the poll failed -- that would hide the very outage it
        exists to report."""
        coordinator.data = snapshot_factory()
        coordinator.last_update_success = False
        sensor = MinifluxReachableBinarySensor(coordinator)
        assert sensor.available is True
        assert sensor.is_on is False  # off, but visibly so

    def test_content_sensor_goes_unavailable_while_reachable_sensor_does_not(
        self, coordinator, snapshot_factory
    ):
        """Direct proof of the asymmetry: same coordinator, same failure,
        opposite availability for the two entity kinds."""
        coordinator.data = snapshot_factory()
        coordinator.last_update_success = False

        content_sensor = MinifluxUnreadSensor(coordinator)
        reachable_sensor = MinifluxReachableBinarySensor(coordinator)

        assert content_sensor.available is False
        assert reachable_sensor.available is True


class TestAttributes:
    def test_last_success_at_reflects_coordinator(self, coordinator, snapshot_factory):
        coordinator.data = snapshot_factory()
        coordinator.last_success_at = NOW
        sensor = MinifluxReachableBinarySensor(coordinator)
        assert sensor.extra_state_attributes["last_success_at"] == NOW.isoformat()

    def test_last_success_at_none_when_never_succeeded(self, coordinator, snapshot_factory):
        coordinator.data = snapshot_factory()
        coordinator.last_success_at = None
        sensor = MinifluxReachableBinarySensor(coordinator)
        assert sensor.extra_state_attributes["last_success_at"] is None

    def test_last_error_reflects_coordinator(self, coordinator, snapshot_factory):
        coordinator.data = snapshot_factory()
        coordinator.last_error = "Miniflux unreachable: connection refused"
        sensor = MinifluxReachableBinarySensor(coordinator)
        assert sensor.extra_state_attributes["last_error"] == coordinator.last_error

    def test_last_webhook_at_reflects_coordinator(self, coordinator, snapshot_factory):
        """Set by Phase 6's note_webhook(); poked directly here since the
        webhook receiver doesn't exist yet."""
        coordinator.data = snapshot_factory()
        coordinator.last_webhook_at = NOW
        sensor = MinifluxReachableBinarySensor(coordinator)
        assert sensor.extra_state_attributes["last_webhook_at"] == NOW.isoformat()

    def test_server_version_reflects_coordinator(self, coordinator, snapshot_factory):
        coordinator.data = snapshot_factory()
        coordinator.server_version = "2.1.0"
        sensor = MinifluxReachableBinarySensor(coordinator)
        assert sensor.extra_state_attributes["server_version"] == "2.1.0"
