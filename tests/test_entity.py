"""Chunk 4.1 — shared entity base + device (architecture §3.6).

One HA device per config entry represents the Miniflux instance; every
entity attaches to it with a stable, distinct unique_id.
"""

from __future__ import annotations

from custom_components.miniflux.const import CONF_URL, DOMAIN
from custom_components.miniflux.entity import MinifluxEntity


class TestDeviceInfo:
    def test_identifiers_include_domain_and_unique_id(self, coordinator):
        entity = MinifluxEntity(coordinator, "some_key")
        assert (DOMAIN, coordinator.config_entry.unique_id) in entity.device_info["identifiers"]

    def test_configuration_url_from_entry(self, coordinator):
        entity = MinifluxEntity(coordinator, "some_key")
        assert entity.device_info["configuration_url"] == coordinator.config_entry.data[CONF_URL]

    def test_manufacturer_is_miniflux(self, coordinator):
        entity = MinifluxEntity(coordinator, "some_key")
        assert entity.device_info["manufacturer"] == "Miniflux"

    def test_sw_version_from_coordinator(self, coordinator):
        coordinator.server_version = "2.1.0"
        entity = MinifluxEntity(coordinator, "some_key")
        assert entity.device_info["sw_version"] == "2.1.0"


class TestUniqueId:
    def test_unique_id_derived_from_entry_and_key(self, coordinator):
        entity = MinifluxEntity(coordinator, "unread_entries")
        assert entity.unique_id == f"{coordinator.config_entry.unique_id}_unread_entries"

    def test_distinct_keys_produce_distinct_unique_ids(self, coordinator):
        ids = {
            MinifluxEntity(coordinator, key).unique_id
            for key in ("unread_entries", "starred_entries", "feeds_with_errors", "reachable")
        }
        assert len(ids) == 4

    def test_has_entity_name_set(self, coordinator):
        entity = MinifluxEntity(coordinator, "some_key")
        assert entity.has_entity_name is True
