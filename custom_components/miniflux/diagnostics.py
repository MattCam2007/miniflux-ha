"""One-click bug-report dump (architecture C7, D10): health and counts only,
never raw entry content -- the same D2 discipline that keeps events compact
applies here, since a diagnostics attachment is just as public as a fired
event once it lands in a GitHub issue.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components import webhook as ha_webhook
from homeassistant.components.diagnostics import async_redact_data
from homeassistant.core import HomeAssistant

from .const import CONF_API_KEY, CONF_LOCAL_ONLY, CONF_WEBHOOK_ID, CONF_WEBHOOK_SECRET

TO_REDACT = {CONF_API_KEY, CONF_WEBHOOK_SECRET, CONF_WEBHOOK_ID}


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry) -> dict[str, Any]:
    coordinator = entry.runtime_data.coordinator
    snapshot = coordinator.data

    return {
        "entry_data": async_redact_data(dict(entry.data), TO_REDACT),
        "entry_options": async_redact_data(dict(entry.options), TO_REDACT),
        "coordinator": {
            "last_update_success": coordinator.last_update_success,
            "last_success_at": _isoformat(coordinator.last_success_at),
            "last_error": coordinator.last_error,
            "last_webhook_at": _isoformat(coordinator.last_webhook_at),
            "server_version": coordinator.server_version,
            "update_interval_seconds": (
                coordinator.update_interval.total_seconds()
                if coordinator.update_interval
                else None
            ),
        },
        "snapshot_summary": _snapshot_summary(snapshot),
        "webhook": {
            "registered": entry.data[CONF_WEBHOOK_ID] in hass.data.get(ha_webhook.DOMAIN, {}),
            "secret_configured": bool(entry.options.get(CONF_WEBHOOK_SECRET)),
            "local_only": entry.options.get(CONF_LOCAL_ONLY, True),
        },
    }


def _isoformat(value) -> str | None:
    return value.isoformat() if value else None


def _snapshot_summary(snapshot) -> dict[str, Any] | None:
    if snapshot is None:
        return None
    return {
        "fetched_at": _isoformat(snapshot.fetched_at),
        "feed_count": len(snapshot.feeds),
        "unread_total": snapshot.unread_total,
        "starred_total": snapshot.starred_total,
        "error_feed_count": len(snapshot.error_feeds),
        "category_count": len(snapshot.unread_by_category),
    }
