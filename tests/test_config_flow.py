"""Chunks 3.1/3.2/3.3 — config, reauth, and options flows (architecture
Config, D9). Miniflux is never actually called: MinifluxClient.get_me is
patched per test so these stay fast, HA-only tests.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from homeassistant.config_entries import SOURCE_REAUTH, SOURCE_USER
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.miniflux import errors
from custom_components.miniflux.const import (
    CONF_API_KEY,
    CONF_LOCAL_ONLY,
    CONF_SCAN_INTERVAL,
    CONF_URL,
    CONF_VERIFY_SSL,
    CONF_WEBHOOK_ID,
    CONF_WEBHOOK_SECRET,
    DOMAIN,
    MIN_SCAN_INTERVAL,
)

USER_INPUT = {
    CONF_URL: "https://reader.example.lan",
    CONF_API_KEY: "test-api-key",
    CONF_VERIFY_SSL: True,
}


def _patch_get_me(return_value=None, side_effect=None):
    mock = AsyncMock(
        return_value=return_value or {"id": 1, "username": "matt"}, side_effect=side_effect
    )
    return patch("custom_components.miniflux.config_flow.MinifluxClient.get_me", new=mock)


class TestUserStep:
    async def test_happy_path_creates_entry_with_webhook_id(self, hass):
        with _patch_get_me():
            result = await hass.config_entries.flow.async_init(
                DOMAIN, context={"source": SOURCE_USER}
            )
            result = await hass.config_entries.flow.async_configure(
                result["flow_id"], USER_INPUT
            )
        assert result["type"] is FlowResultType.CREATE_ENTRY
        assert result["data"][CONF_URL] == USER_INPUT[CONF_URL]
        assert result["data"][CONF_API_KEY] == USER_INPUT[CONF_API_KEY]
        assert CONF_WEBHOOK_ID in result["data"]
        assert result["data"][CONF_WEBHOOK_ID]

    async def test_bad_api_key_shows_invalid_auth(self, hass):
        with _patch_get_me(side_effect=errors.MinifluxAuthError("bad key")):
            result = await hass.config_entries.flow.async_init(
                DOMAIN, context={"source": SOURCE_USER}
            )
            result = await hass.config_entries.flow.async_configure(
                result["flow_id"], USER_INPUT
            )
        assert result["type"] is FlowResultType.FORM
        assert result["errors"] == {"base": "invalid_auth"}

    async def test_unreachable_shows_cannot_connect(self, hass):
        with _patch_get_me(side_effect=errors.MinifluxConnectionError("refused")):
            result = await hass.config_entries.flow.async_init(
                DOMAIN, context={"source": SOURCE_USER}
            )
            result = await hass.config_entries.flow.async_configure(
                result["flow_id"], USER_INPUT
            )
        assert result["type"] is FlowResultType.FORM
        assert result["errors"] == {"base": "cannot_connect"}

    async def test_unexpected_error_shows_unknown(self, hass):
        with _patch_get_me(side_effect=RuntimeError("boom")):
            result = await hass.config_entries.flow.async_init(
                DOMAIN, context={"source": SOURCE_USER}
            )
            result = await hass.config_entries.flow.async_configure(
                result["flow_id"], USER_INPUT
            )
        assert result["type"] is FlowResultType.FORM
        assert result["errors"] == {"base": "unknown"}

    async def test_duplicate_instance_aborts(self, hass):
        existing = MockConfigEntry(
            domain=DOMAIN,
            unique_id="reader.example.lan:1",
            data={**USER_INPUT, CONF_WEBHOOK_ID: "existing-webhook-id"},
        )
        existing.add_to_hass(hass)

        with _patch_get_me():
            result = await hass.config_entries.flow.async_init(
                DOMAIN, context={"source": SOURCE_USER}
            )
            result = await hass.config_entries.flow.async_configure(
                result["flow_id"], USER_INPUT
            )
        assert result["type"] is FlowResultType.ABORT
        assert result["reason"] == "already_configured"

    async def test_url_trailing_slash_normalized(self, hass):
        with _patch_get_me():
            result = await hass.config_entries.flow.async_init(
                DOMAIN, context={"source": SOURCE_USER}
            )
            result = await hass.config_entries.flow.async_configure(
                result["flow_id"], {**USER_INPUT, CONF_URL: "https://reader.example.lan/"}
            )
        assert result["type"] is FlowResultType.CREATE_ENTRY
        assert result["data"][CONF_URL] == "https://reader.example.lan"

    async def test_subpath_url_preserved(self, hass):
        with _patch_get_me():
            result = await hass.config_entries.flow.async_init(
                DOMAIN, context={"source": SOURCE_USER}
            )
            result = await hass.config_entries.flow.async_configure(
                result["flow_id"], {**USER_INPUT, CONF_URL: "https://host/miniflux"}
            )
        assert result["data"][CONF_URL] == "https://host/miniflux"


class TestReauthFlow:
    async def _existing_entry(self, hass) -> MockConfigEntry:
        entry = MockConfigEntry(
            domain=DOMAIN,
            unique_id="reader.example.lan:1",
            data={**USER_INPUT, CONF_WEBHOOK_ID: "existing-webhook-id"},
        )
        entry.add_to_hass(hass)
        return entry

    async def test_auth_failure_starts_reauth_flow(self, hass):
        entry = await self._existing_entry(hass)
        with _patch_get_me():
            entry.async_start_reauth(hass)
            await hass.async_block_till_done()

        flows = hass.config_entries.flow.async_progress_by_handler(DOMAIN)
        assert any(f["context"]["source"] == SOURCE_REAUTH for f in flows)

    async def test_valid_new_key_updates_entry_and_completes(self, hass):
        entry = await self._existing_entry(hass)
        with _patch_get_me():
            entry.async_start_reauth(hass)
            await hass.async_block_till_done()
            flows = hass.config_entries.flow.async_progress_by_handler(DOMAIN)
            flow_id = next(f["flow_id"] for f in flows if f["context"]["source"] == SOURCE_REAUTH)

            result = await hass.config_entries.flow.async_configure(
                flow_id, {CONF_API_KEY: "new-api-key"}
            )
        assert result["type"] is FlowResultType.ABORT
        assert result["reason"] == "reauth_successful"
        assert entry.data[CONF_API_KEY] == "new-api-key"

    async def test_bad_new_key_reshows_form(self, hass):
        entry = await self._existing_entry(hass)
        with _patch_get_me():
            entry.async_start_reauth(hass)
            await hass.async_block_till_done()
        flows = hass.config_entries.flow.async_progress_by_handler(DOMAIN)
        flow_id = next(f["flow_id"] for f in flows if f["context"]["source"] == SOURCE_REAUTH)

        with _patch_get_me(side_effect=errors.MinifluxAuthError("still bad")):
            result = await hass.config_entries.flow.async_configure(
                flow_id, {CONF_API_KEY: "still-bad-key"}
            )
        assert result["type"] is FlowResultType.FORM
        assert result["errors"] == {"base": "invalid_auth"}


class TestOptionsFlow:
    async def _entry(self, hass) -> MockConfigEntry:
        entry = MockConfigEntry(
            domain=DOMAIN,
            unique_id="reader.example.lan:1",
            data={**USER_INPUT, CONF_WEBHOOK_ID: "webhook-abc123"},
        )
        entry.add_to_hass(hass)
        return entry

    async def test_webhook_url_shown_in_placeholders(self, hass):
        entry = await self._entry(hass)
        result = await hass.config_entries.options.async_init(entry.entry_id)
        result = await hass.config_entries.options.async_configure(
            result["flow_id"], {CONF_SCAN_INTERVAL: 300}
        )
        assert "webhook-abc123" in result["description_placeholders"]["webhook_url"]

    async def test_saving_secret_persists_and_round_trips(self, hass):
        entry = await self._entry(hass)
        result = await hass.config_entries.options.async_init(entry.entry_id)
        result = await hass.config_entries.options.async_configure(
            result["flow_id"], {CONF_SCAN_INTERVAL: 300}
        )
        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {CONF_WEBHOOK_SECRET: "s3cr3t", CONF_LOCAL_ONLY: True},
        )
        assert result["type"] is FlowResultType.CREATE_ENTRY
        assert result["data"][CONF_WEBHOOK_SECRET] == "s3cr3t"
        assert result["data"][CONF_LOCAL_ONLY] is True

    async def test_scan_interval_below_floor_rejected(self, hass):
        entry = await self._entry(hass)
        result = await hass.config_entries.options.async_init(entry.entry_id)
        result = await hass.config_entries.options.async_configure(
            result["flow_id"], {CONF_SCAN_INTERVAL: MIN_SCAN_INTERVAL - 1}
        )
        assert result["type"] is FlowResultType.FORM
        assert result["errors"]

    async def test_local_only_defaults_true(self, hass):
        entry = await self._entry(hass)
        result = await hass.config_entries.options.async_init(entry.entry_id)
        result = await hass.config_entries.options.async_configure(
            result["flow_id"], {CONF_SCAN_INTERVAL: 300}
        )
        result = await hass.config_entries.options.async_configure(
            result["flow_id"], {CONF_WEBHOOK_SECRET: "s3cr3t"}
        )
        assert result["data"][CONF_LOCAL_ONLY] is True
