"""Chunks 6.1-6.4 -- the webhook receiver + its repair issues (architecture
D1, §2.1, §3.4). Goes through the real webhook component and HA's aiohttp
test client (not a bare call to the handler function) via a full
hass.config_entries.async_setup(), so the whole path -- HA's WebhookView ->
async_handle_webhook -> our handler -- is exercised the way Miniflux will
actually reach this endpoint. Verification order is the hard invariant this
phase exists to prove: nothing unverified ever reaches hass.bus (D1).
"""

from __future__ import annotations

import hashlib
import hmac
import json
from contextlib import contextmanager
from unittest.mock import AsyncMock, patch

from homeassistant.components import webhook as ha_webhook
from homeassistant.helpers import issue_registry as ir
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.miniflux.const import (
    CONF_API_KEY,
    CONF_LOCAL_ONLY,
    CONF_URL,
    CONF_VERIFY_SSL,
    CONF_WEBHOOK_ID,
    CONF_WEBHOOK_SECRET,
    DOMAIN,
    EVENT_ENTRY_SAVED,
    EVENT_NEW_ENTRIES,
    ISSUE_WEBHOOK_SECRET_MISSING,
    ISSUE_WEBHOOK_SIGNATURE_FAILING,
    WEBHOOK_HEADER_EVENT_TYPE,
    WEBHOOK_HEADER_SIGNATURE,
    WEBHOOK_SIGNATURE_FAILURE_THRESHOLD,
)

SECRET = "s3cr3t"
WEBHOOK_ID = "test-webhook-id"


@contextmanager
def _patched_client(*, feeds=None):
    with (
        patch(
            "custom_components.miniflux.api.MinifluxClient.get_feeds",
            new=AsyncMock(return_value=feeds if feeds is not None else []),
        ),
        patch(
            "custom_components.miniflux.api.MinifluxClient.get_feed_counters",
            new=AsyncMock(return_value={"unreads": {}, "reads": {}}),
        ),
        patch(
            "custom_components.miniflux.api.MinifluxClient.count_entries",
            new=AsyncMock(return_value=0),
        ),
        patch(
            "custom_components.miniflux.api.MinifluxClient.get_version",
            new=AsyncMock(return_value=None),
        ),
    ):
        yield


def _make_entry(hass, *, secret: str | None = SECRET, local_only: bool = True) -> MockConfigEntry:
    options = {CONF_LOCAL_ONLY: local_only}
    if secret is not None:
        options[CONF_WEBHOOK_SECRET] = secret
    entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id="reader.example.lan:1",
        data={
            CONF_URL: "https://reader.example.lan",
            CONF_API_KEY: "test-key",
            CONF_VERIFY_SSL: True,
            CONF_WEBHOOK_ID: WEBHOOK_ID,
        },
        options=options,
    )
    entry.add_to_hass(hass)
    return entry


async def _setup(hass, entry) -> None:
    with _patched_client():
        await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()


def _sign(secret: str, raw_body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()


def _signed(secret: str, payload: dict, *, event_type: str = "new_entries") -> tuple[bytes, dict]:
    raw_body = json.dumps(payload).encode("utf-8")
    headers = {
        WEBHOOK_HEADER_SIGNATURE: _sign(secret, raw_body),
        WEBHOOK_HEADER_EVENT_TYPE: event_type,
        "Content-Type": "application/json",
    }
    return raw_body, headers


def _new_entries_payload(**overrides) -> dict:
    payload = {
        "feed": {
            "id": 10,
            "title": "Example Feed",
            "site_url": "https://example.com",
            "category": {"id": 100, "title": "News"},
        },
        "entries": [
            {
                "id": 1,
                "feed_id": 10,
                "title": "Example title",
                "url": "https://example.com/a",
                "author": "Jane Doe",
                "published_at": "2026-07-16T08:00:00Z",
                "changed_at": "2026-07-16T08:00:00Z",
                "status": "unread",
                "starred": False,
                "reading_time": 5,
                "content": "<p>full body that must never reach the bus</p>",
            }
        ],
    }
    payload.update(overrides)
    return payload


def _save_entry_payload(**overrides) -> dict:
    payload = {
        "entry": {
            "id": 1,
            "feed_id": 10,
            "title": "Saved title",
            "url": "https://example.com/a",
            "author": "Jane Doe",
            "published_at": "2026-07-16T08:00:00Z",
            "changed_at": "2026-07-16T08:00:00Z",
            "status": "unread",
            "starred": False,
            "reading_time": 5,
            "content": "<p>full body</p>",
        }
    }
    payload.update(overrides)
    return payload


async def _post(client, raw_body: bytes, headers: dict):
    return await client.post(
        ha_webhook.async_generate_path(WEBHOOK_ID), data=raw_body, headers=headers
    )


class TestRegisterUnregister:
    async def test_setup_registers_reachable_endpoint(self, hass, hass_client_no_auth):
        entry = _make_entry(hass)
        await _setup(hass, entry)
        client = await hass_client_no_auth()
        raw_body, headers = _signed(SECRET, _new_entries_payload())

        resp = await _post(client, raw_body, headers)

        assert resp.status == 200

    async def test_local_only_defaults_true(self, hass):
        entry = _make_entry(hass)
        await _setup(hass, entry)

        assert hass.data[ha_webhook.DOMAIN][WEBHOOK_ID]["local_only"] is True

    async def test_local_only_false_when_disabled_in_options(self, hass):
        entry = _make_entry(hass, local_only=False)
        await _setup(hass, entry)

        assert hass.data[ha_webhook.DOMAIN][WEBHOOK_ID]["local_only"] is False

    async def test_unload_unregisters_endpoint(self, hass):
        entry = _make_entry(hass)
        await _setup(hass, entry)
        assert WEBHOOK_ID in hass.data[ha_webhook.DOMAIN]

        await hass.config_entries.async_unload(entry.entry_id)
        await hass.async_block_till_done()

        assert WEBHOOK_ID not in hass.data[ha_webhook.DOMAIN]

    async def test_unregistered_endpoint_returns_200_but_does_not_process(
        self, hass, hass_client_no_auth
    ):
        """HA's webhook framework always answers 200 for an unknown id (so a
        prober can't enumerate valid ids) -- confirm unload really tore the
        handler down by asserting no event fires, not by expecting a 404."""
        entry = _make_entry(hass)
        await _setup(hass, entry)
        await hass.config_entries.async_unload(entry.entry_id)
        await hass.async_block_till_done()
        client = await hass_client_no_auth()
        events = []
        hass.bus.async_listen(EVENT_NEW_ENTRIES, events.append)
        raw_body, headers = _signed(SECRET, _new_entries_payload())

        resp = await _post(client, raw_body, headers)
        await hass.async_block_till_done()

        assert resp.status == 200
        assert events == []


class TestSecretMissingRepair:
    async def test_setup_with_no_secret_notes_repair(self, hass):
        entry = _make_entry(hass, secret=None)
        await _setup(hass, entry)

        issue = ir.async_get(hass).async_get_issue(
            DOMAIN, f"{ISSUE_WEBHOOK_SECRET_MISSING}_{entry.entry_id}"
        )
        assert issue is not None

    async def test_setup_with_secret_does_not_note_repair(self, hass):
        entry = _make_entry(hass, secret=SECRET)
        await _setup(hass, entry)

        issue = ir.async_get(hass).async_get_issue(
            DOMAIN, f"{ISSUE_WEBHOOK_SECRET_MISSING}_{entry.entry_id}"
        )
        assert issue is None

    async def test_saving_secret_via_options_clears_repair(self, hass):
        entry = _make_entry(hass, secret=None)
        await _setup(hass, entry)
        assert (
            ir.async_get(hass).async_get_issue(
                DOMAIN, f"{ISSUE_WEBHOOK_SECRET_MISSING}_{entry.entry_id}"
            )
            is not None
        )

        with _patched_client():
            hass.config_entries.async_update_entry(
                entry, options={**entry.options, CONF_WEBHOOK_SECRET: SECRET}
            )
            await hass.async_block_till_done()

        assert (
            ir.async_get(hass).async_get_issue(
                DOMAIN, f"{ISSUE_WEBHOOK_SECRET_MISSING}_{entry.entry_id}"
            )
            is None
        )

    async def test_endpoint_still_reachable_with_no_secret(self, hass, hass_client_no_auth):
        """The endpoint is live from setup on (D9: the URL must exist before
        Miniflux can be told about it) -- a delivery before the secret is
        wired gets an explicit 401, never a silent drop."""
        entry = _make_entry(hass, secret=None)
        await _setup(hass, entry)
        client = await hass_client_no_auth()
        raw_body, headers = _signed(SECRET, _new_entries_payload())

        resp = await _post(client, raw_body, headers)

        assert resp.status == 401


class TestHappyPath:
    async def test_signed_new_entries_returns_200_and_fires_compact_event(
        self, hass, hass_client_no_auth
    ):
        entry = _make_entry(hass)
        await _setup(hass, entry)
        client = await hass_client_no_auth()
        events = []
        hass.bus.async_listen(EVENT_NEW_ENTRIES, events.append)
        raw_body, headers = _signed(SECRET, _new_entries_payload())

        resp = await _post(client, raw_body, headers)
        await hass.async_block_till_done()

        assert resp.status == 200
        assert len(events) == 1
        data = events[0].data
        assert data["feed"]["id"] == 10
        assert data["entry_count"] == 1
        assert data["truncated"] is False
        assert data["entries"][0]["id"] == 1
        assert "content" not in data["entries"][0]
        assert data["config_entry_id"] == entry.entry_id
        assert data["instance_url"] == "https://reader.example.lan"

    async def test_signed_save_entry_returns_200_and_fires_event(
        self, hass, hass_client_no_auth
    ):
        entry = _make_entry(hass)
        await _setup(hass, entry)
        client = await hass_client_no_auth()
        events = []
        hass.bus.async_listen(EVENT_ENTRY_SAVED, events.append)
        raw_body, headers = _signed(SECRET, _save_entry_payload(), event_type="save_entry")

        resp = await _post(client, raw_body, headers)
        await hass.async_block_till_done()

        assert resp.status == 200
        assert len(events) == 1
        assert events[0].data["entry"]["id"] == 1
        assert "content" not in events[0].data["entry"]

    async def test_verified_delivery_updates_last_webhook_at(self, hass, hass_client_no_auth):
        entry = _make_entry(hass)
        await _setup(hass, entry)
        assert entry.runtime_data.coordinator.last_webhook_at is None
        client = await hass_client_no_auth()
        raw_body, headers = _signed(SECRET, _new_entries_payload())

        with _patched_client():
            await _post(client, raw_body, headers)
            await hass.async_block_till_done()

        assert entry.runtime_data.coordinator.last_webhook_at is not None


class TestRejectionPaths:
    async def test_bad_signature_returns_401_and_no_event(self, hass, hass_client_no_auth):
        entry = _make_entry(hass)
        await _setup(hass, entry)
        client = await hass_client_no_auth()
        events = []
        hass.bus.async_listen(EVENT_NEW_ENTRIES, events.append)
        raw_body = json.dumps(_new_entries_payload()).encode("utf-8")
        bad_sig = _sign("wrong-secret", raw_body)
        headers = {WEBHOOK_HEADER_SIGNATURE: bad_sig, WEBHOOK_HEADER_EVENT_TYPE: "new_entries"}

        resp = await _post(client, raw_body, headers)
        await hass.async_block_till_done()

        assert resp.status == 401
        assert events == []

    async def test_missing_signature_header_returns_401_and_no_event(
        self, hass, hass_client_no_auth
    ):
        entry = _make_entry(hass)
        await _setup(hass, entry)
        client = await hass_client_no_auth()
        events = []
        hass.bus.async_listen(EVENT_NEW_ENTRIES, events.append)
        raw_body = json.dumps(_new_entries_payload()).encode("utf-8")

        resp = await _post(client, raw_body, {WEBHOOK_HEADER_EVENT_TYPE: "new_entries"})
        await hass.async_block_till_done()

        assert resp.status == 401
        assert events == []

    async def test_verified_but_malformed_body_returns_400_and_no_event(
        self, hass, hass_client_no_auth
    ):
        entry = _make_entry(hass)
        await _setup(hass, entry)
        client = await hass_client_no_auth()
        events = []
        hass.bus.async_listen(EVENT_NEW_ENTRIES, events.append)
        raw_body = b"not valid json"
        headers = {
            WEBHOOK_HEADER_SIGNATURE: _sign(SECRET, raw_body),
            WEBHOOK_HEADER_EVENT_TYPE: "new_entries",
        }

        resp = await _post(client, raw_body, headers)
        await hass.async_block_till_done()

        assert resp.status == 400
        assert events == []

    async def test_oversized_body_rejected_before_verification(
        self, hass, hass_client_no_auth
    ):
        entry = _make_entry(hass)
        await _setup(hass, entry)
        client = await hass_client_no_auth()
        events = []
        hass.bus.async_listen(EVENT_NEW_ENTRIES, events.append)
        raw_body = b"x" * 11
        # Deliberately unsigned/garbage -- oversized rejection must happen
        # before signature verification even runs.
        headers = {WEBHOOK_HEADER_EVENT_TYPE: "new_entries"}

        with patch("custom_components.miniflux.webhook.WEBHOOK_MAX_BODY_BYTES", 10):
            resp = await _post(client, raw_body, headers)
            await hass.async_block_till_done()

        assert resp.status == 400
        assert events == []

    async def test_oversized_chunked_body_rejected_without_content_length(
        self, hass, hass_client_no_auth
    ):
        """A request with no (or a lying) Content-Length header must still
        be bounded -- the streaming read loop is the real defense, the
        upfront header check is only a fast path on top of it."""
        entry = _make_entry(hass)
        await _setup(hass, entry)
        client = await hass_client_no_auth()
        events = []
        hass.bus.async_listen(EVENT_NEW_ENTRIES, events.append)

        async def _chunks():
            for _ in range(3):
                yield b"xxxxx"

        headers = {WEBHOOK_HEADER_EVENT_TYPE: "new_entries"}

        with patch("custom_components.miniflux.webhook.WEBHOOK_MAX_BODY_BYTES", 10):
            resp = await client.post(
                ha_webhook.async_generate_path(WEBHOOK_ID), data=_chunks(), headers=headers
            )
            await hass.async_block_till_done()

        assert "Content-Length" not in resp.request_info.headers
        assert resp.status == 400
        assert events == []

    async def test_unexpected_exception_maps_to_400_not_500(self, hass, hass_client_no_auth):
        entry = _make_entry(hass)
        await _setup(hass, entry)
        client = await hass_client_no_auth()
        events = []
        hass.bus.async_listen(EVENT_NEW_ENTRIES, events.append)
        raw_body, headers = _signed(SECRET, _new_entries_payload())

        with patch(
            "custom_components.miniflux.webhook.parse_and_project",
            side_effect=RuntimeError("boom"),
        ):
            resp = await _post(client, raw_body, headers)
            await hass.async_block_till_done()

        assert resp.status == 400
        assert events == []


class TestSignatureFailingRepair:
    async def test_repeated_bad_signatures_raises_issue_only_at_threshold(
        self, hass, hass_client_no_auth
    ):
        entry = _make_entry(hass)
        await _setup(hass, entry)
        client = await hass_client_no_auth()
        raw_body = json.dumps(_new_entries_payload()).encode("utf-8")
        bad_headers = {
            WEBHOOK_HEADER_SIGNATURE: _sign("wrong-secret", raw_body),
            WEBHOOK_HEADER_EVENT_TYPE: "new_entries",
        }
        issue_id = f"{ISSUE_WEBHOOK_SIGNATURE_FAILING}_{entry.entry_id}"

        for _ in range(WEBHOOK_SIGNATURE_FAILURE_THRESHOLD - 1):
            await _post(client, raw_body, bad_headers)
        assert ir.async_get(hass).async_get_issue(DOMAIN, issue_id) is None

        await _post(client, raw_body, bad_headers)

        assert ir.async_get(hass).async_get_issue(DOMAIN, issue_id) is not None

    async def test_good_delivery_after_failures_clears_issue_and_resets_counter(
        self, hass, hass_client_no_auth
    ):
        entry = _make_entry(hass)
        await _setup(hass, entry)
        client = await hass_client_no_auth()
        raw_body = json.dumps(_new_entries_payload()).encode("utf-8")
        bad_headers = {
            WEBHOOK_HEADER_SIGNATURE: _sign("wrong-secret", raw_body),
            WEBHOOK_HEADER_EVENT_TYPE: "new_entries",
        }
        issue_id = f"{ISSUE_WEBHOOK_SIGNATURE_FAILING}_{entry.entry_id}"
        for _ in range(WEBHOOK_SIGNATURE_FAILURE_THRESHOLD):
            await _post(client, raw_body, bad_headers)
        assert ir.async_get(hass).async_get_issue(DOMAIN, issue_id) is not None

        good_body, good_headers = _signed(SECRET, _new_entries_payload())
        with _patched_client():
            await _post(client, good_body, good_headers)
            await hass.async_block_till_done()

        assert ir.async_get(hass).async_get_issue(DOMAIN, issue_id) is None

        # Counter must have reset -- one more bad signature alone shouldn't
        # immediately re-raise the issue.
        await _post(client, raw_body, bad_headers)
        assert ir.async_get(hass).async_get_issue(DOMAIN, issue_id) is None
