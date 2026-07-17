"""Card bundle delivery (F-U1, D-5/D-9): static path + Lovelace resource.

The only integration-code change the frontend subtree needs. Registers the
committed ``frontend/miniflux-cards.js`` bundle at a static path once per HA
run, and -- on storage-mode dashboards -- auto-adds it as a Lovelace module
resource with a ``?v=<integration version>`` cache-buster so upgrades bust
the browser cache without ever creating a duplicate resource entry. YAML-mode
dashboards can't be edited programmatically; those users add the resource
line documented in docs/setup.md.

Framework-coupled by nature (registers against hass.http / the lovelace
component), so this lives in the HA-coupled test ring, not pure core.
"""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.const import CONF_ID, CONF_URL
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .const import DOMAIN, FRONTEND_BUNDLE_FILENAME, FRONTEND_URL_BASE

_LOGGER = logging.getLogger(__name__)

RESOURCE_URL_PATH = f"{FRONTEND_URL_BASE}/{FRONTEND_BUNDLE_FILENAME}"
CONF_RESOURCE_TYPE_WS = "res_type"
RESOURCE_TYPE_MODULE = "module"

_DATA_FRONTEND_REGISTERED = "frontend_static_path_registered"


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Register the static path (once) and reconcile the Lovelace resource.

    Safe to call on every config entry setup/reload: the static path guard
    makes registration idempotent, and the resource reconciliation below is
    naturally idempotent (it only writes when the stored URL differs).
    """
    domain_data = hass.data.setdefault(DOMAIN, {})
    if not domain_data.get(_DATA_FRONTEND_REGISTERED):
        frontend_dir = Path(__file__).parent / "frontend"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(FRONTEND_URL_BASE, str(frontend_dir), True)]
        )
        domain_data[_DATA_FRONTEND_REGISTERED] = True

    await _async_ensure_lovelace_resource(hass)


async def _async_ensure_lovelace_resource(hass: HomeAssistant) -> None:
    # Local import: homeassistant.components.lovelace is a separate optional
    # component; importing it at module load time would fail hassfest's
    # dependency checks unless declared, and it need not be a hard dependency
    # -- a dashboard-less HA install (rare, but possible) just skips this.
    try:
        from homeassistant.components.lovelace.const import LOVELACE_DATA, MODE_STORAGE
    except ImportError:
        _LOGGER.debug("Lovelace component not available; skipping resource registration")
        return

    lovelace_data = hass.data.get(LOVELACE_DATA)
    if lovelace_data is None:
        _LOGGER.debug("Lovelace not set up yet; skipping resource auto-registration")
        return

    if lovelace_data.resource_mode != MODE_STORAGE:
        _LOGGER.info(
            "Lovelace is running in YAML mode; add the Miniflux card bundle "
            "resource manually -- see docs/setup.md"
        )
        return

    integration = await async_get_integration(hass, DOMAIN)
    resource_url = f"{RESOURCE_URL_PATH}?v={integration.version}"

    resources = lovelace_data.resources
    await resources.async_get_info()  # ensures resources.loaded, no-op if already loaded

    existing = next(
        (
            item
            for item in resources.async_items()
            if item[CONF_URL].split("?", 1)[0] == RESOURCE_URL_PATH
        ),
        None,
    )

    if existing is None:
        await resources.async_create_item(
            {CONF_RESOURCE_TYPE_WS: RESOURCE_TYPE_MODULE, CONF_URL: resource_url}
        )
    elif existing[CONF_URL] != resource_url:
        await resources.async_update_item(existing[CONF_ID], {CONF_URL: resource_url})
