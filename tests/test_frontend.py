"""F-U1 -- static path + Lovelace resource registration (frontend.py).

Exercises custom_components.miniflux.frontend directly against a hass with
the real http/lovelace components set up (pytest-homeassistant-custom-
component's bare `hass` fixture has neither by default), per the plan's
`00-START-HERE.md` step 1 spike. See tests/test_init.py for the end-to-end
proof that async_setup_entry actually calls this.
"""

from __future__ import annotations

import sys
from unittest.mock import AsyncMock, patch

import pytest
from homeassistant.setup import async_setup_component

from custom_components.miniflux.const import DOMAIN
from custom_components.miniflux.frontend import (
    RESOURCE_URL_PATH,
    async_register_frontend,
)

MANIFEST_VERSION = "0.1.0"


@pytest.fixture
async def hass_http(hass):
    await async_setup_component(hass, "http", {})
    return hass


@pytest.fixture
async def hass_lovelace_storage(hass_http):
    await async_setup_component(hass_http, "lovelace", {})
    return hass_http


def _resource_items(hass):
    from homeassistant.components.lovelace.const import LOVELACE_DATA

    return hass.data[LOVELACE_DATA].resources.async_items()


class TestStaticPath:
    async def test_registers_static_path_once(self, hass_http):
        wrapped = AsyncMock(wraps=hass_http.http.async_register_static_paths)
        with patch.object(hass_http.http, "async_register_static_paths", wrapped):
            await async_register_frontend(hass_http)
            await async_register_frontend(hass_http)

        assert wrapped.await_count == 1

    async def test_marks_domain_data_registered(self, hass_http):
        await async_register_frontend(hass_http)

        assert hass_http.data[DOMAIN]["frontend_static_path_registered"] is True


class TestLovelaceResourceStorageMode:
    async def test_creates_resource_with_version_cache_bust(self, hass_lovelace_storage):
        await async_register_frontend(hass_lovelace_storage)

        items = _resource_items(hass_lovelace_storage)
        assert len(items) == 1
        assert items[0]["url"] == f"{RESOURCE_URL_PATH}?v={MANIFEST_VERSION}"
        assert items[0]["type"] == "module"

    async def test_resource_not_duplicated_across_reloads(self, hass_lovelace_storage):
        await async_register_frontend(hass_lovelace_storage)
        first_items = _resource_items(hass_lovelace_storage)

        await async_register_frontend(hass_lovelace_storage)
        await async_register_frontend(hass_lovelace_storage)
        second_items = _resource_items(hass_lovelace_storage)

        assert len(second_items) == 1
        assert second_items[0]["id"] == first_items[0]["id"]

    async def test_version_bump_updates_existing_resource_url_in_place(
        self, hass_lovelace_storage
    ):
        await async_register_frontend(hass_lovelace_storage)
        original_id = _resource_items(hass_lovelace_storage)[0]["id"]

        fake_integration = AsyncMock()
        fake_integration.version = "9.9.9"
        with patch(
            "custom_components.miniflux.frontend.async_get_integration",
            new=AsyncMock(return_value=fake_integration),
        ):
            await async_register_frontend(hass_lovelace_storage)

        items = _resource_items(hass_lovelace_storage)
        assert len(items) == 1
        assert items[0]["id"] == original_id
        assert items[0]["url"] == f"{RESOURCE_URL_PATH}?v=9.9.9"

    async def test_unrelated_resource_left_untouched(self, hass_lovelace_storage):
        from homeassistant.components.lovelace.const import LOVELACE_DATA

        resources = hass_lovelace_storage.data[LOVELACE_DATA].resources
        await resources.async_get_info()
        await resources.async_create_item(
            {"res_type": "module", "url": "/local/some-other-card.js"}
        )

        await async_register_frontend(hass_lovelace_storage)

        items = _resource_items(hass_lovelace_storage)
        urls = {item["url"] for item in items}
        assert "/local/some-other-card.js" in urls
        assert f"{RESOURCE_URL_PATH}?v={MANIFEST_VERSION}" in urls
        assert len(items) == 2


class TestLovelaceEdgeCases:
    async def test_yaml_mode_skips_resource_and_does_not_raise(self, hass_http):
        await async_setup_component(hass_http, "lovelace", {"lovelace": {"mode": "yaml"}})

        await async_register_frontend(hass_http)  # must not raise

    async def test_no_lovelace_setup_skips_and_does_not_raise(self, hass_http):
        await async_register_frontend(hass_http)  # must not raise; lovelace absent

    async def test_lovelace_component_unimportable_skips_and_does_not_raise(
        self, hass_lovelace_storage
    ):
        with patch.dict(sys.modules, {"homeassistant.components.lovelace.const": None}):
            await async_register_frontend(hass_lovelace_storage)  # must not raise
