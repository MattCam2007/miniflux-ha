"""Chunk 0.4 — manifest.json and hacs.json are valid and carry required keys.

Turns "the JSON is valid" into an actual test (plans/01-scaffolding-and-hacs.md
chunk 0.4), so a careless edit is caught by unit test, not only by the hassfest/
HACS CI actions.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
MANIFEST_PATH = REPO_ROOT / "custom_components" / "miniflux" / "manifest.json"
HACS_PATH = REPO_ROOT / "hacs.json"

SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")
URL_RE = re.compile(r"^https?://")

# HA's allowed iot_class values (homeassistant.loader / manifest schema).
VALID_IOT_CLASSES = {
    "assumed_state",
    "cloud_polling",
    "cloud_push",
    "local_polling",
    "local_push",
    "calculated",
}


def _load(path: Path) -> dict:
    return json.loads(path.read_text())


def test_manifest_is_valid_json():
    manifest = _load(MANIFEST_PATH)
    assert isinstance(manifest, dict)


def test_manifest_domain_is_miniflux():
    manifest = _load(MANIFEST_PATH)
    assert manifest["domain"] == "miniflux"


def test_manifest_version_is_semver():
    manifest = _load(MANIFEST_PATH)
    assert SEMVER_RE.match(manifest["version"]), manifest["version"]


def test_manifest_config_flow_enabled():
    manifest = _load(MANIFEST_PATH)
    assert manifest["config_flow"] is True


def test_manifest_has_no_runtime_requirements():
    """Architecture D6: embedded async client, no third-party PyPI dependency."""
    manifest = _load(MANIFEST_PATH)
    assert manifest["requirements"] == []


def test_manifest_depends_on_webhook_component():
    """Phase 6's receiver needs HA's webhook component available at load time."""
    manifest = _load(MANIFEST_PATH)
    assert "webhook" in manifest["dependencies"]


def test_manifest_documentation_and_issue_tracker_are_urls():
    manifest = _load(MANIFEST_PATH)
    assert URL_RE.match(manifest["documentation"])
    assert URL_RE.match(manifest["issue_tracker"])


def test_manifest_iot_class_is_valid():
    manifest = _load(MANIFEST_PATH)
    assert manifest["iot_class"] in VALID_IOT_CLASSES


def test_manifest_has_codeowners():
    manifest = _load(MANIFEST_PATH)
    assert manifest["codeowners"]
    assert all(owner.startswith("@") for owner in manifest["codeowners"])


def test_hacs_json_is_valid():
    hacs = _load(HACS_PATH)
    assert isinstance(hacs, dict)
    assert hacs["name"]
    assert hacs["render_readme"] is True


def test_hacs_json_homeassistant_floor_is_2025_6_0():
    hacs = _load(HACS_PATH)
    assert hacs["homeassistant"] == "2025.6.0"
