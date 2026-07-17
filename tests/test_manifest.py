"""Chunk 0.4 — manifest.json and hacs.json are valid and carry required keys.

Turns "the JSON is valid" into an actual test (plans/01-scaffolding-and-hacs.md
chunk 0.4), so a careless edit is caught by unit test, not only by the hassfest/
HACS CI actions.
"""

from __future__ import annotations

import json
import re
import struct
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
MANIFEST_PATH = REPO_ROOT / "custom_components" / "miniflux" / "manifest.json"
HACS_PATH = REPO_ROOT / "hacs.json"
BRAND_ICON_PATH = REPO_ROOT / "custom_components" / "miniflux" / "brand" / "icon.png"

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"

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


def test_manifest_depends_on_http_component():
    """F-U1's frontend.py registers a static path via hass.http -- hassfest's
    dependency check flags any hass.http usage not declared here."""
    manifest = _load(MANIFEST_PATH)
    assert "http" in manifest["dependencies"]


def test_manifest_has_lovelace_as_an_after_dependency():
    """frontend.py's Lovelace-resource registration is soft (an ImportError /
    absent dashboard is handled gracefully, never required for setup), so
    lovelace belongs in after_dependencies, not a hard dependency."""
    manifest = _load(MANIFEST_PATH)
    assert "lovelace" in manifest.get("after_dependencies", [])
    assert "lovelace" not in manifest["dependencies"]


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


def test_manifest_keys_are_sorted_domain_name_then_alphabetical():
    """hassfest's own manifest-key-order rule: `domain`, `name`, then every
    other key alphabetically. json.loads preserves file order (Python 3.7+
    dicts), so this reads the *actual* on-disk key order, not a re-sorted
    copy -- a key added out of place fails this the same way hassfest would."""
    keys = list(_load(MANIFEST_PATH).keys())
    assert keys[0] == "domain"
    assert keys[1] == "name"
    assert keys[2:] == sorted(keys[2:])


def test_hacs_json_is_valid():
    hacs = _load(HACS_PATH)
    assert isinstance(hacs, dict)
    assert hacs["name"]
    assert hacs["render_readme"] is True


def test_hacs_json_homeassistant_floor_is_2025_6_0():
    hacs = _load(HACS_PATH)
    assert hacs["homeassistant"] == "2025.6.0"


def test_brand_icon_exists_and_is_a_square_png():
    """HACS's brands check (hacs.xyz/docs/publish/include#check-brands): since
    HA 2026.3, a custom integration can ship its own brand icon in-repo at
    custom_components/<domain>/brand/icon.png instead of registering in the
    community home-assistant/brands repo. Parses the PNG header directly
    (no Pillow dependency) to confirm it's a real, square image, not just a
    file that happens to be named right.
    """
    assert BRAND_ICON_PATH.exists(), f"missing {BRAND_ICON_PATH}"
    data = BRAND_ICON_PATH.read_bytes()
    assert data[:8] == PNG_SIGNATURE, "not a valid PNG file"
    # IHDR is always the first chunk: 4-byte length, 4-byte type, then
    # 4-byte width + 4-byte height, big-endian (PNG spec).
    assert data[12:16] == b"IHDR"
    width, height = struct.unpack(">II", data[16:24])
    assert width == height, f"brand icon must be square, got {width}x{height}"
    assert width >= 256, f"brand icon should be at least 256x256, got {width}x{height}"
