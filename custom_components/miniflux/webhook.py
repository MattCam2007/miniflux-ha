"""Terminates Miniflux's native signed webhook inside the integration
(architecture D1, §2.1, §3.4). Verification order is a hard invariant: read
raw bytes -> verify HMAC (constant-time) -> only then parse JSON -> emit ->
nudge the coordinator. Nothing unverified ever reaches hass.bus -- that
admission control is this module's entire reason to exist.

The endpoint is registered unconditionally at setup, not only once a secret
is configured: D9's two-phase handshake requires the webhook URL to exist
(and be live) before the user can paste it into Miniflux, and Miniflux may
already be pointed at it during the gap between "URL saved in Miniflux" and
"secret pasted back into HA options." A delivery arriving during that gap
gets an explicit 401 + a webhook_secret_missing repair issue -- never a
silent drop -- which requires a real handler to be listening, not an absent
registration (see docs/setup.md Part 2, plans/07-webhook-receiver.md's
resolution note).
"""

from __future__ import annotations

import logging

from aiohttp import web
from homeassistant.components import webhook as ha_webhook
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from . import repairs
from .const import (
    CONF_LOCAL_ONLY,
    CONF_URL,
    CONF_WEBHOOK_ID,
    CONF_WEBHOOK_SECRET,
    WEBHOOK_HEADER_SIGNATURE,
    WEBHOOK_MAX_BODY_BYTES,
    WEBHOOK_SIGNATURE_FAILURE_THRESHOLD,
)
from .signature import extract_event_type, verify
from .webhook_payload import PayloadError, parse_and_project

_LOGGER = logging.getLogger(__name__)

_READ_CHUNK_BYTES = 65536


class _BodyTooLarge(Exception):
    """Internal control-flow signal; never escapes this module."""


class _WebhookState:
    """Per-entry, in-memory only -- a fresh instance every registration
    (including reload-on-options-change) is correct, since this only tracks
    *currently* failing deliveries, not anything that needs to survive a
    restart."""

    __slots__ = ("consecutive_signature_failures",)

    def __init__(self) -> None:
        self.consecutive_signature_failures = 0


def async_register_webhook(hass: HomeAssistant, entry: ConfigEntry) -> None:
    state = _WebhookState()

    async def _handler(
        hass: HomeAssistant, webhook_id: str, request: web.Request
    ) -> web.Response:
        return await _handle_delivery(hass, entry, state, request)

    ha_webhook.async_register(
        hass,
        entry.domain,
        "Miniflux",
        entry.data[CONF_WEBHOOK_ID],
        _handler,
        local_only=entry.options.get(CONF_LOCAL_ONLY, True),
    )

    if entry.options.get(CONF_WEBHOOK_SECRET):
        repairs.async_clear_secret_missing(hass, entry)
    else:
        repairs.async_note_secret_missing(hass, entry)


def async_unregister_webhook(hass: HomeAssistant, entry: ConfigEntry) -> None:
    ha_webhook.async_unregister(hass, entry.data[CONF_WEBHOOK_ID])
    repairs.async_clear_secret_missing(hass, entry)
    repairs.async_clear_signature_failing(hass, entry)


async def _handle_delivery(
    hass: HomeAssistant, entry: ConfigEntry, state: _WebhookState, request: web.Request
) -> web.Response:
    try:
        return await _process_delivery(hass, entry, state, request)
    except Exception:
        _LOGGER.exception("Unexpected error handling a Miniflux webhook delivery")
        return web.Response(status=400)


async def _process_delivery(
    hass: HomeAssistant, entry: ConfigEntry, state: _WebhookState, request: web.Request
) -> web.Response:
    try:
        raw_body = await _read_bounded_body(request)
    except _BodyTooLarge:
        _LOGGER.warning("Rejected oversized Miniflux webhook delivery")
        return web.Response(status=400, text="payload too large")

    secret = entry.options.get(CONF_WEBHOOK_SECRET, "")
    if not secret:
        repairs.async_note_secret_missing(hass, entry)
        return web.Response(status=401)

    provided_signature = request.headers.get(WEBHOOK_HEADER_SIGNATURE, "")
    if not verify(secret, raw_body, provided_signature):
        state.consecutive_signature_failures += 1
        if state.consecutive_signature_failures >= WEBHOOK_SIGNATURE_FAILURE_THRESHOLD:
            repairs.async_note_signature_failing(hass, entry)
        return web.Response(status=401)

    if state.consecutive_signature_failures:
        state.consecutive_signature_failures = 0
        repairs.async_clear_signature_failing(hass, entry)

    event_type = extract_event_type(request.headers)
    projected = parse_and_project(raw_body, event_type)
    if isinstance(projected, PayloadError):
        _LOGGER.warning("Rejected malformed Miniflux webhook delivery: %s", projected.reason)
        return web.Response(status=400, text=projected.reason)

    hass.bus.async_fire(
        projected.ha_event_type,
        {
            **projected.payload,
            "config_entry_id": entry.entry_id,
            "instance_url": entry.data[CONF_URL],
        },
    )
    await entry.runtime_data.coordinator.note_webhook()
    return web.Response(status=200)


async def _read_bounded_body(request: web.Request) -> bytes:
    content_length = request.content_length
    if content_length is not None and content_length > WEBHOOK_MAX_BODY_BYTES:
        raise _BodyTooLarge

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await request.content.read(_READ_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > WEBHOOK_MAX_BODY_BYTES:
            raise _BodyTooLarge
        chunks.append(chunk)
    return b"".join(chunks)
