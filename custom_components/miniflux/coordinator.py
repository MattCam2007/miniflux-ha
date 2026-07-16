"""The polling coordinator (architecture §2.3, D4): poll is authoritative,
webhooks (Phase 6) are an accelerator via note_webhook()'s debounced nudge.
Sensors and health state must be correct with webhooks entirely
unconfigured -- only latency depends on them.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.debounce import Debouncer
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from . import errors
from .api import MinifluxClient
from .const import CONF_URL, DOMAIN, REFRESH_DEBOUNCE_SECONDS
from .models import Snapshot
from .rollup import build_snapshot
from .transitions import diff

_LOGGER = logging.getLogger(__name__)


class MinifluxCoordinator(DataUpdateCoordinator[Snapshot]):
    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        client: MinifluxClient,
        update_interval: timedelta,
    ) -> None:
        super().__init__(
            hass,
            _LOGGER,
            config_entry=entry,
            name=f"{DOMAIN}_{entry.entry_id}",
            update_interval=update_interval,
            # immediate=True: the first refresh request in a burst fires
            # right away (sensors converge quickly after a webhook); rapid
            # follow-ups within the cooldown window coalesce into a single
            # trailing call instead of each triggering their own fetch.
            # immediate=False would do the opposite -- wait for a quiet
            # period before fetching at all, so sensors would update
            # *slower* the more webhook activity there is.
            request_refresh_debouncer=Debouncer(
                hass, _LOGGER, cooldown=REFRESH_DEBOUNCE_SECONDS, immediate=True
            ),
        )
        self.client = client
        self._prev_snapshot: Snapshot | None = None
        self.last_success_at: datetime | None = None
        self.last_error: str | None = None
        self.last_webhook_at: datetime | None = None
        self.server_version: str | None = None

    async def _async_update_data(self) -> Snapshot:
        try:
            feeds, counters, starred_total = await asyncio.gather(
                self.client.get_feeds(),
                self.client.get_feed_counters(),
                self.client.count_entries({"starred": True}),
            )
        except errors.MinifluxAuthError as err:
            self.last_error = str(err)
            raise ConfigEntryAuthFailed(str(err)) from err
        except errors.MinifluxError as err:
            self.last_error = str(err)
            raise UpdateFailed(str(err)) from err

        now = dt_util.utcnow()
        snapshot = build_snapshot(feeds, counters, starred_total, now)

        for event in diff(self._prev_snapshot, snapshot):
            self.hass.bus.async_fire(
                event.event_type,
                {
                    **event.payload,
                    "config_entry_id": self.config_entry.entry_id,
                    "instance_url": self.config_entry.data[CONF_URL],
                },
            )
        self._prev_snapshot = snapshot

        self.last_success_at = now
        self.last_error = None
        return snapshot

    async def async_fetch_server_version(self) -> None:
        """Best-effort, fetched once at setup (not part of the recurring
        poll cycle) -- a cosmetic device-info field must never fail setup."""
        try:
            self.server_version = await self.client.get_version()
        except errors.MinifluxError:
            self.server_version = None

    async def note_webhook(self) -> None:
        """Called by the Phase 6 webhook receiver on every verified
        delivery: bumps last_webhook_at and nudges a debounced refresh so
        sensors converge quickly without every delivery triggering its own
        immediate poll (D4)."""
        self.last_webhook_at = dt_util.utcnow()
        await self.async_request_refresh()
