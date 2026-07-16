"""The async Miniflux API client (architecture §3.1, D6). The only module
that imports aiohttp and the only place that knows Miniflux's endpoint
paths/params alongside normalize.py's field-name knowledge (seam corollary).

Uses the caller's aiohttp.ClientSession (HA's shared session in production)
rather than owning one, so tests and production share one code path.
"""

from __future__ import annotations

import asyncio
import json as json_module
from typing import Any

import aiohttp

from . import errors, normalize
from .const import (
    API_AUTH_HEADER,
    API_CONCURRENCY,
    API_GET_RETRY_DELAY_SECONDS,
    API_PATH_CATEGORIES,
    API_PATH_DISCOVER,
    API_PATH_ENTRIES,
    API_PATH_EXPORT,
    API_PATH_FEED_COUNTERS,
    API_PATH_FEEDS,
    API_PATH_IMPORT,
    API_PATH_ME,
    API_TIMEOUT_SECONDS,
    API_VERSION_PATH_ROOT,
    API_VERSION_PATH_V1,
)
from .models import Entry, Feed
from .rollup import CountersRaw

# Miniflux's own practical per-request page size. query_entries walks pages
# using this internally regardless of what `limit` a caller's params dict
# carries -- the walk's own `limit` kwarg is the real stopping condition.
_ENTRIES_PAGE_SIZE = 100


def _stringify(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _flatten_params(params: dict[str, Any]) -> list[tuple[str, str]]:
    """Expand list-valued params (e.g. status=[...]) into repeated
    (key, value) pairs -- the HTTP-encoding detail filters.py deliberately
    defers to this module (architecture §3.3)."""
    flat: list[tuple[str, str]] = []
    for key, value in params.items():
        if isinstance(value, (list, tuple)):
            flat.extend((key, _stringify(item)) for item in value)
        else:
            flat.append((key, _stringify(value)))
    return flat


async def _safe_read_body(resp: aiohttp.ClientResponse) -> dict | str | None:
    try:
        text = await resp.text()
    except aiohttp.ClientError:
        return None
    if not text:
        return None
    try:
        return json_module.loads(text)
    except (json_module.JSONDecodeError, ValueError):
        return text


class MinifluxClient:
    """Thin async client over Miniflux's REST API. Callers speak Phase-1
    models and pure request/response dicts; only this module touches HTTP."""

    def __init__(
        self,
        session: aiohttp.ClientSession,
        base_url: str,
        api_key: str,
        *,
        verify_ssl: bool = True,
        timeout: float = API_TIMEOUT_SECONDS,
        concurrency: int = API_CONCURRENCY,
        retry_delay: float = API_GET_RETRY_DELAY_SECONDS,
    ) -> None:
        self._session = session
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._verify_ssl = verify_ssl
        self._timeout = aiohttp.ClientTimeout(total=timeout)
        self._semaphore = asyncio.Semaphore(concurrency)
        self._retry_delay = retry_delay

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        data: str | bytes | None = None,
        parse_json: bool = True,
    ) -> Any:
        """``data`` and ``parse_json=False`` exist for the two OPML endpoints
        (chunk 2.5), which speak raw XML text rather than JSON -- everything
        else uses the ``json``/JSON-response default."""
        url = f"{self._base_url}{path}"
        headers = {API_AUTH_HEADER: self._api_key}
        query = _flatten_params(params) if params else None

        # Idempotent GETs get one retry on connectivity/5xx; mutations never
        # retry (D10) -- a re-run of a declarative mutation is the caller's
        # safe retry, and retrying a write blindly risks double effects.
        is_get = method.upper() == "GET"
        attempts = 2 if is_get else 1

        for attempt in range(attempts):
            if attempt > 0:
                await asyncio.sleep(self._retry_delay)
            try:
                async with (
                    self._semaphore,
                    self._session.request(
                        method,
                        url,
                        headers=headers,
                        params=query,
                        json=json,
                        data=data,
                        timeout=self._timeout,
                        ssl=self._verify_ssl,
                    ) as resp,
                ):
                    if resp.status >= 400:
                        body = await _safe_read_body(resp)
                        mapped = errors.map_http_error(resp.status, body)
                        retryable = isinstance(mapped, errors.MinifluxServerError)
                        if retryable and attempt + 1 < attempts:
                            continue
                        raise mapped
                    text = await resp.text()
                    if not parse_json:
                        return text
                    return json_module.loads(text) if text else None
            except (TimeoutError, aiohttp.ClientError) as err:
                if attempt + 1 < attempts:
                    continue
                raise errors.MinifluxConnectionError(str(err)) from err

    # --- Read endpoints (architecture §2.3 step 1 -- the coordinator's poll). ---

    async def get_me(self) -> dict[str, Any]:
        return await self._request("GET", API_PATH_ME)

    async def get_version(self) -> str | None:
        """Best-effort server version for device info. Tolerates older
        instances lacking /v1/version by falling back to /version; if
        neither exists, returns None rather than failing setup over a
        cosmetic field."""
        try:
            data = await self._request("GET", API_VERSION_PATH_V1)
        except errors.MinifluxNotFoundError:
            try:
                data = await self._request("GET", API_VERSION_PATH_ROOT)
            except errors.MinifluxNotFoundError:
                return None
        if isinstance(data, dict):
            version = data.get("version")
            return version if isinstance(version, str) else None
        if isinstance(data, str):
            return data
        return None

    async def get_feeds(self) -> list[Feed]:
        data = await self._request("GET", API_PATH_FEEDS)
        return [normalize.feed_from_json(item) for item in data]

    async def get_feed_counters(self) -> CountersRaw:
        """Miniflux's JSON keys feeds by string id (all JSON object keys
        are strings); convert to int here so rollup.py can join directly
        against Feed.id without knowing about this wire quirk."""
        data = await self._request("GET", API_PATH_FEED_COUNTERS)
        return {
            "reads": {int(k): v for k, v in data.get("reads", {}).items()},
            "unreads": {int(k): v for k, v in data.get("unreads", {}).items()},
        }

    # --- Entries query + pagination (architecture §3.3, D7). ---
    #
    # There is deliberately no separate "scoped" (/v1/feeds/{id}/entries)
    # code path: filters.py already encodes feed_id/category_id as query
    # params against the global /v1/entries endpoint, so a scoped-path
    # variant would just be a second way to express the same filter.

    async def query_entries(self, params: dict[str, Any], *, limit: int) -> tuple[int, list[Entry]]:
        """Auto-paginate GET /v1/entries up to `limit` entries (or until
        Miniflux is exhausted, whichever comes first). Returns Miniflux's
        true total match count alongside whatever was actually collected,
        so callers can tell a capped result from a complete one."""
        entries: list[Entry] = []
        total = 0
        offset = 0

        while len(entries) < limit:
            page_size = min(_ENTRIES_PAGE_SIZE, limit - len(entries))
            page_params = {**params, "limit": page_size, "offset": offset}
            data = await self._request("GET", API_PATH_ENTRIES, params=page_params)
            total = data.get("total", 0)
            page_entries = data.get("entries", [])
            entries.extend(normalize.entry_from_json(item) for item in page_entries)
            offset += len(page_entries)
            if len(page_entries) < page_size or offset >= total:
                break  # Miniflux has nothing more to give, regardless of `limit`

        return total, entries

    async def count_entries(self, params: dict[str, Any]) -> int:
        """Cheap pre-flight: the total match count without materializing
        entries (the batch consumer's pre-check, architecture §3.3)."""
        count_params = {**params, "limit": 1, "offset": 0}
        data = await self._request("GET", API_PATH_ENTRIES, params=count_params)
        return data.get("total", 0)

    # --- Entry hydration & mutation (architecture §3.3, D8). ---
    #
    # Note on `include_content`/`fetch_original`: Miniflux's entry JSON
    # always carries full content -- there is no wire-level flag to suppress
    # it, so there is nothing for this layer to toggle. "Content only in
    # responses that asked for it" (D2) is enforced by Phase 5 services
    # stripping the field from their response envelope, not by this client
    # requesting less than Miniflux always sends. Readability re-fetching
    # (fetch-content) is scoped out of this chunk as an optional-tier
    # feature -- it is a genuine extra HTTP call per entry, not needed for
    # the core hydration path to work.

    async def get_entries_by_id(self, entry_ids: list[int]) -> tuple[list[Entry], list[int]]:
        """Hydrate entries by id, concurrently (the concurrency cap is
        enforced per-call by _request's semaphore). Ids Miniflux 404s on
        land in `missing` rather than failing the whole batch -- webhook-
        sourced ids can race a deletion (architecture §3.3)."""

        async def _fetch_one(entry_id: int) -> Entry | None:
            try:
                data = await self._request("GET", f"{API_PATH_ENTRIES}/{entry_id}")
            except errors.MinifluxNotFoundError:
                return None
            return normalize.entry_from_json(data)

        results = await asyncio.gather(*(_fetch_one(entry_id) for entry_id in entry_ids))
        entries = [entry for entry in results if entry is not None]
        missing = [
            entry_id
            for entry_id, entry in zip(entry_ids, results, strict=True)
            if entry is None
        ]
        return entries, missing

    async def set_entries_status(self, entry_ids: list[int], status: str) -> int:
        await self._request(
            "PUT", API_PATH_ENTRIES, json={"entry_ids": entry_ids, "status": status}
        )
        return len(entry_ids)

    async def set_entries_starred(self, entry_ids: list[int], starred: bool) -> int:
        """Declarative wrapper over Miniflux's toggle-only bookmark endpoint
        (D8): reads each entry's current starred state and toggles only the
        ones that differ, so calling this twice with the same arguments is
        idempotent -- a retried script step can't double-flip the flag."""

        async def _read_starred(entry_id: int) -> bool:
            data = await self._request("GET", f"{API_PATH_ENTRIES}/{entry_id}")
            return bool(data.get("starred", False))

        current = await asyncio.gather(*(_read_starred(entry_id) for entry_id in entry_ids))
        to_toggle = [
            entry_id
            for entry_id, is_starred in zip(entry_ids, current, strict=True)
            if is_starred != starred
        ]

        async def _toggle(entry_id: int) -> None:
            await self._request("PUT", f"{API_PATH_ENTRIES}/{entry_id}/bookmark")

        await asyncio.gather(*(_toggle(entry_id) for entry_id in to_toggle))
        return len(to_toggle)

    # --- Feed admin (architecture §3.3 admin family, §4 Rule 3: one method
    # per verb; refresh_feed and refresh_all_feeds are deliberately separate
    # methods, not one method with a bulk flag, so the two blast-radius
    # classes can never be a typo apart). ---

    async def create_feed(
        self,
        feed_url: str,
        *,
        category_id: int | None = None,
        crawler: bool | None = None,
        **extra: Any,
    ) -> int:
        body: dict[str, Any] = {"feed_url": feed_url}
        if category_id is not None:
            body["category_id"] = category_id
        if crawler is not None:
            body["crawler"] = crawler
        body.update(extra)
        data = await self._request("POST", API_PATH_FEEDS, json=body)
        return data["feed_id"]

    async def update_feed(self, feed_id: int, **fields: Any) -> None:
        await self._request("PUT", f"{API_PATH_FEEDS}/{feed_id}", json=fields)

    async def delete_feed(self, feed_id: int) -> None:
        await self._request("DELETE", f"{API_PATH_FEEDS}/{feed_id}")

    async def refresh_feed(self, feed_id: int) -> None:
        await self._request("PUT", f"{API_PATH_FEEDS}/{feed_id}/refresh")

    async def refresh_all_feeds(self) -> None:
        await self._request("PUT", f"{API_PATH_FEEDS}/refresh")

    # --- Category admin. ---

    async def get_categories(self) -> list[dict[str, Any]]:
        return await self._request("GET", API_PATH_CATEGORIES)

    async def create_category(self, title: str) -> int:
        data = await self._request("POST", API_PATH_CATEGORIES, json={"title": title})
        return data["id"]

    async def update_category(self, category_id: int, title: str) -> None:
        await self._request("PUT", f"{API_PATH_CATEGORIES}/{category_id}", json={"title": title})

    async def delete_category(self, category_id: int) -> None:
        await self._request("DELETE", f"{API_PATH_CATEGORIES}/{category_id}")

    # --- Discovery + OPML (optional tier: thin passthroughs, not load-bearing
    # for the core reactive/batch paths). ---

    async def discover(self, url: str) -> list[dict[str, Any]]:
        return await self._request("POST", API_PATH_DISCOVER, json={"url": url})

    async def export_opml(self) -> str:
        return await self._request("GET", API_PATH_EXPORT, parse_json=False)

    async def import_opml(self, opml: str) -> None:
        await self._request("POST", API_PATH_IMPORT, data=opml, parse_json=False)
