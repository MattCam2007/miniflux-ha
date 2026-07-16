"""Repair issues for webhook *wiring* problems (architecture C7, D10).

Content-level problems (broken feeds) are never repairs -- they belong to
the feed-error sensor and miniflux_feed_error/_recovered events (C2/C3).
This module's only job is a namespaced, idempotent create/clear pair per
issue type; the decisions about *when* to call them (setup-time secret
check, N-consecutive-signature-failures threshold) live in webhook.py.

Issue ids are suffixed with the config entry id so multiple Miniflux
instances never share (and can't accidentally clear) each other's issues.
"""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir

from .const import (
    CONF_URL,
    DOMAIN,
    ISSUE_WEBHOOK_SECRET_MISSING,
    ISSUE_WEBHOOK_SIGNATURE_FAILING,
)


def _issue_id(base: str, entry: ConfigEntry) -> str:
    return f"{base}_{entry.entry_id}"


def _placeholders(entry: ConfigEntry) -> dict[str, str]:
    return {"instance_url": entry.data[CONF_URL]}


def async_note_secret_missing(hass: HomeAssistant, entry: ConfigEntry) -> None:
    ir.async_create_issue(
        hass,
        DOMAIN,
        _issue_id(ISSUE_WEBHOOK_SECRET_MISSING, entry),
        is_fixable=False,
        severity=ir.IssueSeverity.WARNING,
        translation_key=ISSUE_WEBHOOK_SECRET_MISSING,
        translation_placeholders=_placeholders(entry),
    )


def async_clear_secret_missing(hass: HomeAssistant, entry: ConfigEntry) -> None:
    ir.async_delete_issue(hass, DOMAIN, _issue_id(ISSUE_WEBHOOK_SECRET_MISSING, entry))


def async_note_signature_failing(hass: HomeAssistant, entry: ConfigEntry) -> None:
    ir.async_create_issue(
        hass,
        DOMAIN,
        _issue_id(ISSUE_WEBHOOK_SIGNATURE_FAILING, entry),
        is_fixable=False,
        severity=ir.IssueSeverity.WARNING,
        translation_key=ISSUE_WEBHOOK_SIGNATURE_FAILING,
        translation_placeholders=_placeholders(entry),
    )


def async_clear_signature_failing(hass: HomeAssistant, entry: ConfigEntry) -> None:
    ir.async_delete_issue(hass, DOMAIN, _issue_id(ISSUE_WEBHOOK_SIGNATURE_FAILING, entry))
