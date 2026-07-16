"""Chunk 8.1 -- one-click bug-report dump that never leaks secrets
(architecture C7). Counts and health only, never entry content (D2
discipline continues all the way to the diagnostics surface).
"""

from __future__ import annotations

from datetime import UTC, datetime

from homeassistant.components import webhook as ha_webhook

from custom_components.miniflux.const import CONF_LOCAL_ONLY, CONF_WEBHOOK_SECRET
from custom_components.miniflux.diagnostics import async_get_config_entry_diagnostics
from custom_components.miniflux.models import CategoryUnread


class TestRedaction:
    async def test_api_key_is_redacted(self, hass, entry_with_client):
        result = await async_get_config_entry_diagnostics(hass, entry_with_client)

        assert "test-api-key" not in str(result)
        assert result["entry_data"]["api_key"] == "**REDACTED**"

    async def test_webhook_secret_is_redacted(self, hass, entry_with_client):
        hass.config_entries.async_update_entry(
            entry_with_client, options={CONF_WEBHOOK_SECRET: "s3cr3t-value", CONF_LOCAL_ONLY: True}
        )

        result = await async_get_config_entry_diagnostics(hass, entry_with_client)

        assert "s3cr3t-value" not in str(result)
        assert result["entry_options"]["webhook_secret"] == "**REDACTED**"

    async def test_webhook_id_is_redacted(self, hass, entry_with_client):
        result = await async_get_config_entry_diagnostics(hass, entry_with_client)

        assert "test-webhook-id" not in str(result)


class TestHealthAndSummary:
    async def test_coordinator_health_fields_present(self, hass, entry_with_client):
        coordinator = entry_with_client.runtime_data.coordinator
        coordinator.last_success_at = datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC)
        coordinator.last_error = None
        coordinator.server_version = "2.1.0"
        coordinator.last_webhook_at = datetime(2026, 7, 16, 8, 5, 0, tzinfo=UTC)

        result = await async_get_config_entry_diagnostics(hass, entry_with_client)

        health = result["coordinator"]
        assert health["last_success_at"] == "2026-07-16T08:00:00+00:00"
        assert health["last_error"] is None
        assert health["server_version"] == "2.1.0"
        assert health["last_webhook_at"] == "2026-07-16T08:05:00+00:00"
        assert health["last_update_success"] is True
        assert health["update_interval_seconds"] == 300

    async def test_snapshot_summary_is_counts_only_no_entry_content(
        self, hass, entry_with_client, snapshot_factory, make_feed
    ):
        coordinator = entry_with_client.runtime_data.coordinator
        coordinator.data = snapshot_factory(
            unread_total=42,
            starred_total=7,
            unread_by_category=(CategoryUnread(id=100, title="News", unread=42),),
            feeds=(make_feed(id=1), make_feed(id=2, parsing_error_count=3)),
            error_feeds=(make_feed(id=2, parsing_error_count=3),),
        )

        result = await async_get_config_entry_diagnostics(hass, entry_with_client)

        summary = result["snapshot_summary"]
        assert summary["feed_count"] == 2
        assert summary["unread_total"] == 42
        assert summary["starred_total"] == 7
        assert summary["error_feed_count"] == 1
        assert summary["category_count"] == 1
        assert "entries" not in str(result).lower().replace("snapshot_summary", "")
        assert "Example Feed" not in str(result)  # feed titles are entry-adjacent content

    async def test_snapshot_summary_none_before_first_refresh(self, hass, entry_with_client):
        entry_with_client.runtime_data.coordinator.data = None

        result = await async_get_config_entry_diagnostics(hass, entry_with_client)

        assert result["snapshot_summary"] is None


class TestWebhookStatus:
    async def test_secret_configured_true_when_set(self, hass, entry_with_client):
        hass.config_entries.async_update_entry(
            entry_with_client, options={CONF_WEBHOOK_SECRET: "shh", CONF_LOCAL_ONLY: True}
        )

        result = await async_get_config_entry_diagnostics(hass, entry_with_client)

        assert result["webhook"]["secret_configured"] is True

    async def test_secret_configured_false_when_unset(self, hass, entry_with_client):
        result = await async_get_config_entry_diagnostics(hass, entry_with_client)

        assert result["webhook"]["secret_configured"] is False

    async def test_registered_reflects_real_handler_registration(self, hass, entry_with_client):
        result_before = await async_get_config_entry_diagnostics(hass, entry_with_client)
        assert result_before["webhook"]["registered"] is False

        ha_webhook.async_register(
            hass, "miniflux", "Miniflux", "test-webhook-id", lambda *a: None
        )
        result_after = await async_get_config_entry_diagnostics(hass, entry_with_client)

        assert result_after["webhook"]["registered"] is True

    async def test_local_only_reflects_options_default_true(self, hass, entry_with_client):
        result = await async_get_config_entry_diagnostics(hass, entry_with_client)

        assert result["webhook"]["local_only"] is True
