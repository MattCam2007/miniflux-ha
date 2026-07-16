"""Shared test harness for the Miniflux integration test suite.

Model-dependent builders (``snapshot_factory``, ``fake_api``,
``signed_webhook_request``) are added in Phase 1 (chunk 1.1) once
``custom_components.miniflux.models`` exists — see plans/02-pure-core.md.
Keeping them out of Phase 0 avoids a forward dependency on not-yet-built
modules (plans/00-overview.md §2: a chunk's tests must pass with only prior
chunks present).
"""

from __future__ import annotations

import pytest

pytest_plugins = "pytest_homeassistant_custom_component"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Make custom_components/ discoverable in every test (HA hides it by default)."""
    yield


@pytest.fixture
def mock_config_entry_data():
    """Plain-dict config-entry data for the Miniflux integration.

    Deliberately a plain dict (not a MockConfigEntry) here in Phase 0 so this
    fixture has no dependency on the config flow (Phase 3). Phase 3 adds a
    ``mock_config_entry`` fixture that wraps this into a real MockConfigEntry.
    """
    return {
        "url": "https://reader.example.lan",
        "api_key": "test-api-key",
        "verify_ssl": True,
        "webhook_id": "test-webhook-id",
    }
