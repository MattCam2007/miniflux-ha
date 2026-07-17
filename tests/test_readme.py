"""Chunk 8.3 -- guards README.md against drifting from the code it
describes. Not a rendering/link-validity check (no network in tests) -- a
presence check that every entity, event, and service the code actually
ships is still named in the README, and that install/setup.md are linked.
"""

from __future__ import annotations

from pathlib import Path

from custom_components.miniflux.const import (
    EVENT_ENTRY_SAVED,
    EVENT_FEED_ERROR,
    EVENT_FEED_RECOVERED,
    EVENT_NEW_ENTRIES,
    SERVICE_COUNT_ENTRIES,
    SERVICE_CREATE_CATEGORY,
    SERVICE_CREATE_FEED,
    SERVICE_DELETE_CATEGORY,
    SERVICE_DELETE_FEED,
    SERVICE_DISCOVER_FEEDS,
    SERVICE_EXPORT_OPML,
    SERVICE_GET_CATEGORIES,
    SERVICE_GET_ENTRIES,
    SERVICE_GET_FEEDS,
    SERVICE_IMPORT_OPML,
    SERVICE_MARK_ALL_READ,
    SERVICE_REFRESH_ALL_FEEDS,
    SERVICE_REFRESH_FEED,
    SERVICE_SEARCH_ENTRIES,
    SERVICE_UPDATE_CATEGORY,
    SERVICE_UPDATE_ENTRIES,
    SERVICE_UPDATE_FEED,
)

REPO_ROOT = Path(__file__).parent.parent

ALL_SERVICES = {
    SERVICE_SEARCH_ENTRIES,
    SERVICE_COUNT_ENTRIES,
    SERVICE_GET_CATEGORIES,
    SERVICE_GET_ENTRIES,
    SERVICE_GET_FEEDS,
    SERVICE_UPDATE_ENTRIES,
    SERVICE_MARK_ALL_READ,
    SERVICE_CREATE_FEED,
    SERVICE_UPDATE_FEED,
    SERVICE_DELETE_FEED,
    SERVICE_REFRESH_FEED,
    SERVICE_REFRESH_ALL_FEEDS,
    SERVICE_DISCOVER_FEEDS,
    SERVICE_CREATE_CATEGORY,
    SERVICE_UPDATE_CATEGORY,
    SERVICE_DELETE_CATEGORY,
    SERVICE_EXPORT_OPML,
    SERVICE_IMPORT_OPML,
}

ALL_EVENTS = {EVENT_NEW_ENTRIES, EVENT_ENTRY_SAVED, EVENT_FEED_ERROR, EVENT_FEED_RECOVERED}

ALL_ENTITY_IDS = {
    "sensor.miniflux_unread_entries",
    "sensor.miniflux_starred_entries",
    "sensor.miniflux_feeds_with_errors",
    "binary_sensor.miniflux_reachable",
}


def _readme() -> str:
    return (REPO_ROOT / "README.md").read_text()


def test_references_hacs_install():
    text = _readme().lower()
    assert "hacs" in text
    assert "custom repositor" in text


def test_links_to_setup_md():
    assert "docs/setup.md" in _readme()


def test_links_to_architecture_md():
    assert "docs/architecture.md" in _readme()


def test_lists_every_entity_id():
    text = _readme()
    missing = [e for e in ALL_ENTITY_IDS if e not in text]
    assert missing == []


def test_lists_every_event_type():
    text = _readme()
    missing = [e for e in ALL_EVENTS if e not in text]
    assert missing == []


def test_lists_every_service_name():
    text = _readme()
    missing = [s for s in ALL_SERVICES if f"`miniflux.{s}`" not in text and s not in text]
    assert missing == []


def test_states_minimum_ha_version():
    assert "2025.6" in _readme()


def test_mentions_known_limitations_r3_and_replay():
    text = _readme().lower()
    assert "tag" in text
    assert "replay" in text


def test_license_file_exists_and_is_mit():
    license_text = (REPO_ROOT / "LICENSE").read_text()
    assert "MIT License" in license_text
