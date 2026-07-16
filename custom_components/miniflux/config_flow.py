"""Config, reauth, and options flows for the Miniflux integration.

The options flow's webhook step is deliberately separate from the initial
config flow (D9): Miniflux only generates the webhook secret *after* the
webhook URL has been saved in it, so the secret cannot exist during initial
setup. See docs/setup.md Part 2 for the user-facing sequence this mirrors.
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlparse

import voluptuous as vol
from homeassistant.components import webhook
from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from . import errors
from .api import MinifluxClient
from .const import (
    CONF_API_KEY,
    CONF_LOCAL_ONLY,
    CONF_SCAN_INTERVAL,
    CONF_URL,
    CONF_VERIFY_SSL,
    CONF_WEBHOOK_ID,
    CONF_WEBHOOK_SECRET,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    MIN_SCAN_INTERVAL,
)

_LOGGER = logging.getLogger(__name__)

STEP_USER_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_URL): str,
        vol.Required(CONF_API_KEY): str,
        vol.Optional(CONF_VERIFY_SSL, default=True): bool,
    }
)

STEP_REAUTH_SCHEMA = vol.Schema({vol.Required(CONF_API_KEY): str})


async def _validate_credentials(
    hass, url: str, api_key: str, verify_ssl: bool
) -> tuple[dict[str, Any] | None, str | None]:
    """Returns (me, None) on success or (None, error_code) on failure."""
    session = async_get_clientsession(hass, verify_ssl=verify_ssl)
    client = MinifluxClient(session, url, api_key, verify_ssl=verify_ssl)
    try:
        me = await client.get_me()
    except errors.MinifluxAuthError:
        return None, "invalid_auth"
    except errors.MinifluxConnectionError:
        return None, "cannot_connect"
    except Exception:
        _LOGGER.exception("Unexpected error validating Miniflux credentials")
        return None, "unknown"
    return me, None


def _unique_id_for(url: str, user_id: Any) -> str:
    parsed = urlparse(url)
    return f"{parsed.netloc}{parsed.path}:{user_id}"


class MinifluxConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        form_errors: dict[str, str] = {}
        if user_input is not None:
            url = user_input[CONF_URL].rstrip("/")
            verify_ssl = user_input[CONF_VERIFY_SSL]
            me, error_code = await _validate_credentials(
                self.hass, url, user_input[CONF_API_KEY], verify_ssl
            )
            if error_code:
                form_errors["base"] = error_code
            else:
                await self.async_set_unique_id(_unique_id_for(url, me.get("id")))
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=url,
                    data={
                        CONF_URL: url,
                        CONF_API_KEY: user_input[CONF_API_KEY],
                        CONF_VERIFY_SSL: verify_ssl,
                        CONF_WEBHOOK_ID: webhook.async_generate_id(),
                    },
                )
        return self.async_show_form(
            step_id="user", data_schema=STEP_USER_SCHEMA, errors=form_errors
        )

    async def async_step_reauth(
        self, entry_data: dict[str, Any]
    ) -> ConfigFlowResult:
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        form_errors: dict[str, str] = {}
        reauth_entry = self._get_reauth_entry()
        if user_input is not None:
            _, error_code = await _validate_credentials(
                self.hass,
                reauth_entry.data[CONF_URL],
                user_input[CONF_API_KEY],
                reauth_entry.data[CONF_VERIFY_SSL],
            )
            if error_code:
                form_errors["base"] = error_code
            else:
                return self.async_update_reload_and_abort(
                    reauth_entry,
                    data={**reauth_entry.data, CONF_API_KEY: user_input[CONF_API_KEY]},
                )
        return self.async_show_form(
            step_id="reauth_confirm", data_schema=STEP_REAUTH_SCHEMA, errors=form_errors
        )

    @staticmethod
    def async_get_options_flow(config_entry: ConfigEntry) -> MinifluxOptionsFlow:
        return MinifluxOptionsFlow()


class MinifluxOptionsFlow(OptionsFlow):
    """Two steps: polling settings, then the D9 webhook handshake."""

    def __init__(self) -> None:
        self._settings: dict[str, Any] = {}

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        form_errors: dict[str, str] = {}
        if user_input is not None:
            scan_interval = user_input[CONF_SCAN_INTERVAL]
            if scan_interval < MIN_SCAN_INTERVAL:
                form_errors["base"] = "scan_interval_too_low"
            else:
                self._settings[CONF_SCAN_INTERVAL] = scan_interval
                return await self.async_step_webhook()

        current_interval = self.config_entry.options.get(
            CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL
        )
        schema = vol.Schema(
            {vol.Required(CONF_SCAN_INTERVAL, default=current_interval): int}
        )
        return self.async_show_form(
            step_id="init", data_schema=schema, errors=form_errors
        )

    async def async_step_webhook(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(
                data={
                    **self._settings,
                    CONF_WEBHOOK_SECRET: user_input.get(CONF_WEBHOOK_SECRET, ""),
                    CONF_LOCAL_ONLY: user_input.get(CONF_LOCAL_ONLY, True),
                }
            )

        webhook_id = self.config_entry.data[CONF_WEBHOOK_ID]
        webhook_url = webhook.async_generate_url(self.hass, webhook_id)
        current_secret = self.config_entry.options.get(CONF_WEBHOOK_SECRET, "")
        current_local_only = self.config_entry.options.get(CONF_LOCAL_ONLY, True)
        schema = vol.Schema(
            {
                vol.Optional(CONF_WEBHOOK_SECRET, default=current_secret): str,
                vol.Optional(CONF_LOCAL_ONLY, default=current_local_only): bool,
            }
        )
        return self.async_show_form(
            step_id="webhook",
            data_schema=schema,
            description_placeholders={"webhook_url": webhook_url},
        )
