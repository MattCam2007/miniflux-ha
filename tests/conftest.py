"""Shared test harness for the Miniflux integration test suite.

``fake_api`` is deferred to Phase 2, once ``api.py``'s real method
signatures exist to mirror exactly — stubbing it earlier risks drifting
from the real contract.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import UTC, datetime

import pytest

from custom_components.miniflux.const import WEBHOOK_HEADER_EVENT_TYPE, WEBHOOK_HEADER_SIGNATURE
from custom_components.miniflux.models import CategoryUnread, Entry, Feed, Snapshot

pytest_plugins = "pytest_homeassistant_custom_component"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Make custom_components/ discoverable in every test (HA hides it by default)."""
    yield


@pytest.fixture
def make_feed():
    """Builder for Feed models with sensible defaults; override any field."""

    def _build(**overrides) -> Feed:
        fields = dict(
            id=10,
            title="Example Feed",
            site_url="https://example.com",
            feed_url="https://example.com/feed.xml",
            category_id=100,
            category_title="News",
            checked_at=datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC),
            parsing_error_count=0,
            parsing_error_message="",
            disabled=False,
        )
        fields.update(overrides)
        return Feed(**fields)

    return _build


@pytest.fixture
def make_entry():
    """Builder for Entry models with sensible defaults; override any field."""

    def _build(**overrides) -> Entry:
        now = datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC)
        fields = dict(
            id=1,
            feed_id=10,
            feed_title="Example Feed",
            category_id=100,
            category_title="News",
            title="Example title",
            url="https://example.com/a",
            author="Jane Doe",
            published_at=now,
            changed_at=now,
            status="unread",
            starred=False,
            reading_time=5,
            tags=("tag1", "tag2"),
        )
        fields.update(overrides)
        return Entry(**fields)

    return _build


@pytest.fixture
def snapshot_factory():
    """Builder for Snapshot models with tunable unread/starred/error-feed state."""

    def _build(
        *,
        fetched_at: datetime | None = None,
        unread_total: int = 0,
        starred_total: int = 0,
        unread_by_feed: dict[int, int] | None = None,
        unread_by_category: tuple[CategoryUnread, ...] = (),
        feeds: tuple[Feed, ...] = (),
        error_feeds: tuple[Feed, ...] = (),
    ) -> Snapshot:
        return Snapshot(
            fetched_at=fetched_at or datetime(2026, 7, 16, 8, 0, 0, tzinfo=UTC),
            feeds=feeds,
            unread_total=unread_total,
            unread_by_feed=unread_by_feed or {},
            unread_by_category=unread_by_category,
            starred_total=starred_total,
            error_feeds=error_feeds,
        )

    return _build


@pytest.fixture
def signed_webhook_request():
    """Build a (raw_body, headers) pair signed the way Miniflux is assumed to
    sign webhooks (hex HMAC-SHA256 over the raw body — ASSUMED (R1)).

    Mirrors ``signature.py``'s scheme independently (does not import or call
    it) so that a test asserting the two agree (test_signature.py) is a real
    check, not a tautology. If R1 finds the scheme differs, both this helper
    and signature.verify change together.
    """

    def _build(
        secret: str, payload: dict, *, event_type: str = "new_entries"
    ) -> tuple[bytes, dict[str, str]]:
        raw_body = json.dumps(payload).encode("utf-8")
        sig = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        headers = {
            WEBHOOK_HEADER_SIGNATURE: sig,
            WEBHOOK_HEADER_EVENT_TYPE: event_type,
            "Content-Type": "application/json",
        }
        return raw_body, headers

    return _build


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
