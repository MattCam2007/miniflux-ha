"""Chunk 8.2 -- strings.json / translations/en.json coverage (architecture
C7 follow-on, D10 continued into the UI). hassfest itself isn't wired into
this repo's CI (see tests/test_seams.py's services.yaml guard for the same
reasoning) -- these tests are the local substitute: every user-visible key
the code can actually produce must resolve to real text, services.yaml must
carry schema only (current HA convention -- see the resolution note in
plans/08-diagnostics-i18n-release.md), and strings.json/translations/en.json
must never drift apart.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

from custom_components.miniflux.const import (
    CONF_API_KEY,
    CONF_LOCAL_ONLY,
    CONF_SCAN_INTERVAL,
    CONF_URL,
    CONF_VERIFY_SSL,
    CONF_WEBHOOK_SECRET,
    DOMAIN,
    ISSUE_WEBHOOK_SECRET_MISSING,
    ISSUE_WEBHOOK_SIGNATURE_FAILING,
    SERVICE_COUNT_ENTRIES,
    SERVICE_CREATE_CATEGORY,
    SERVICE_CREATE_FEED,
    SERVICE_DELETE_CATEGORY,
    SERVICE_DELETE_FEED,
    SERVICE_DISCOVER_FEEDS,
    SERVICE_EXPORT_OPML,
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
from custom_components.miniflux.services import async_register_services

PACKAGE_DIR = Path(__file__).parent.parent / "custom_components" / "miniflux"

# Every error/abort code raised by config_flow.py -- see that module for
# exactly where each one is set (_validate_credentials, the two default
# reasons from _abort_if_unique_id_configured / async_update_reload_and_abort).
CONFIG_ERRORS = {"invalid_auth", "cannot_connect", "unknown"}
CONFIG_ABORTS = {"already_configured", "reauth_successful"}
OPTIONS_ERRORS = {"scan_interval_too_low"}

ALL_SERVICES = {
    SERVICE_SEARCH_ENTRIES,
    SERVICE_COUNT_ENTRIES,
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

ENTITY_TRANSLATION_KEYS = {
    "sensor": {"unread_entries", "starred_entries", "feeds_with_errors"},
    "binary_sensor": {"reachable"},
}

ALL_ISSUES = {ISSUE_WEBHOOK_SECRET_MISSING, ISSUE_WEBHOOK_SIGNATURE_FAILING}


@pytest.fixture
def strings() -> dict:
    return json.loads((PACKAGE_DIR / "strings.json").read_text())


@pytest.fixture
def services_yaml() -> dict:
    return yaml.safe_load((PACKAGE_DIR / "services.yaml").read_text())


def test_en_json_matches_strings_json_exactly():
    strings_content = json.loads((PACKAGE_DIR / "strings.json").read_text())
    en_content = json.loads((PACKAGE_DIR / "translations" / "en.json").read_text())
    assert strings_content == en_content


class TestConfigFlowStrings:
    def test_every_error_code_has_text(self, strings):
        for code in CONFIG_ERRORS:
            assert strings["config"]["error"].get(code), f"missing config error: {code}"

    def test_every_abort_code_has_text(self, strings):
        for code in CONFIG_ABORTS:
            assert strings["config"]["abort"].get(code), f"missing config abort: {code}"

    def test_user_step_covers_every_data_field(self, strings):
        data = strings["config"]["step"]["user"]["data"]
        assert set(data) == {CONF_URL, CONF_API_KEY, CONF_VERIFY_SSL}

    def test_reauth_confirm_step_covers_its_field(self, strings):
        data = strings["config"]["step"]["reauth_confirm"]["data"]
        assert set(data) == {CONF_API_KEY}


class TestOptionsFlowStrings:
    def test_every_error_code_has_text(self, strings):
        for code in OPTIONS_ERRORS:
            assert strings["options"]["error"].get(code), f"missing options error: {code}"

    def test_init_step_covers_its_field(self, strings):
        data = strings["options"]["step"]["init"]["data"]
        assert set(data) == {CONF_SCAN_INTERVAL}

    def test_webhook_step_covers_its_fields_and_url_placeholder(self, strings):
        data = strings["options"]["step"]["webhook"]["data"]
        assert set(data) == {CONF_WEBHOOK_SECRET, CONF_LOCAL_ONLY}
        assert "{webhook_url}" in strings["options"]["step"]["webhook"]["description"]


class TestEntityStrings:
    def test_every_translation_key_has_a_name(self, strings):
        for platform, keys in ENTITY_TRANSLATION_KEYS.items():
            for key in keys:
                assert strings["entity"][platform][key]["name"], (
                    f"missing entity name: {platform}.{key}"
                )

    def test_documented_entity_ids_match_translation_keys(self, strings):
        """docs/architecture.md §3.6 and docs/setup.md both promise
        sensor.miniflux_unread_entries / _starred_entries /
        _feeds_with_errors and binary_sensor.miniflux_reachable -- the
        actual entity_id slug is derived from has_entity_name + the
        resolved translation name, so the strings.json name text must
        slugify back to exactly those words."""
        assert strings["entity"]["sensor"]["unread_entries"]["name"] == "Unread entries"
        assert strings["entity"]["sensor"]["starred_entries"]["name"] == "Starred entries"
        assert strings["entity"]["sensor"]["feeds_with_errors"]["name"] == "Feeds with errors"
        assert strings["entity"]["binary_sensor"]["reachable"]["name"] == "Reachable"


class TestServiceStrings:
    def test_every_registered_service_has_name_and_description(self, strings):
        for service in ALL_SERVICES:
            entry = strings["services"][service]
            assert entry["name"]
            assert entry["description"]

    def test_no_service_or_field_text_left_in_services_yaml(self, services_yaml):
        """Current HA convention: name/description text lives only in
        strings.json; services.yaml carries schema/selectors only (a
        description present in both is a hassfest duplication warning)."""
        offenders = []
        for service_name, service_def in services_yaml.items():
            if "description" in service_def or "name" in service_def:
                offenders.append(service_name)
            for field_name, field_def in (service_def.get("fields") or {}).items():
                if "description" in field_def or "name" in field_def:
                    offenders.append(f"{service_name}.{field_name}")
        assert offenders == []

    def test_every_services_yaml_field_has_a_strings_json_entry(self, strings, services_yaml):
        missing = []
        for service_name, service_def in services_yaml.items():
            field_strings = strings["services"].get(service_name, {}).get("fields", {})
            for field_name in service_def.get("fields") or {}:
                if field_name not in field_strings or not field_strings[field_name].get("name"):
                    missing.append(f"{service_name}.{field_name}")
        assert missing == []

    async def test_services_yaml_and_strings_match_registered_services(self, hass, strings):
        """Same guard as test_seams.py's services.yaml <-> registered-service
        check, extended to strings.json: every live service has both."""
        async_register_services(hass)
        registered = set(hass.services.async_services().get(DOMAIN, {}).keys())
        assert registered == set(strings["services"])


class TestIssueStrings:
    def test_every_issue_has_title_and_description(self, strings):
        for issue_id in ALL_ISSUES:
            entry = strings["issues"][issue_id]
            assert entry["title"]
            assert entry["description"]

    def test_issue_descriptions_reference_instance_url_placeholder(self, strings):
        """Matches repairs.py's translation_placeholders={"instance_url": ...} --
        an issue that doesn't say *which* instance is broken is not useful
        in a multi-instance setup."""
        for issue_id in ALL_ISSUES:
            assert "{instance_url}" in strings["issues"][issue_id]["description"]
