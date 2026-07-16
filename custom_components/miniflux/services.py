"""The service layer (architecture §3.3, §4): the programmable surface Unity
scripts call. Services validate (schema + pure filters) before any HTTP,
dispatch to api.py, and shape responses via pure mappers -- never a bare
client call inline, never HTTP parsing here (seam rule 2).

Split by responsibility per architecture §4's three rules, not by endpoint:
query family shares one filter schema (Rule 1); entry-mutation is
declarative-over-a-set vs. scope-level mark-all as separate blast-radius
classes (Rule 2); admin is one service per verb for honest static schemas,
with the destructive verb isolated (Rule 3).
"""

from __future__ import annotations

from collections.abc import Coroutine
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.util import dt as dt_util

from . import errors
from .const import (
    DOMAIN,
    ENTRY_STATUSES,
    HYDRATE_IDS_MAX,
    SEARCH_LIMIT_DEFAULT,
    SEARCH_LIMIT_MAX,
    SERVICE_COUNT_ENTRIES,
    SERVICE_CREATE_CATEGORY,
    SERVICE_CREATE_FEED,
    SERVICE_DELETE_CATEGORY,
    SERVICE_DELETE_FEED,
    SERVICE_DISCOVER_FEEDS,
    SERVICE_EXPORT_OPML,
    SERVICE_GET_ENTRIES,
    SERVICE_GET_FEEDS,
    SERVICE_IMPORT_OPML,
    SERVICE_MARK_ALL_READ,
    SERVICE_REFRESH_ALL_FEEDS,
    SERVICE_REFRESH_FEED,
    SERVICE_SEARCH_ENTRIES,
    SERVICE_UPDATE_CATEGORY,
    SERVICE_UPDATE_ENTRIES,
    SERVICE_UPDATE_FEED,
    UPDATE_IDS_MAX,
)
from .filters import (
    EntryFilter,
    FilterError,
    ResolvedFilter,
    resolve_refs,
    to_query_params,
    validate_entry_ids,
)
from .models import Entry, Feed
from .timeutil import TimeParseError

# Service-call field names (schema keys) -- distinct from CONF_* (config
# entry data/options keys) in const.py.
FIELD_CONFIG_ENTRY_ID = "config_entry_id"
FIELD_CATEGORY = "category"
FIELD_FEED = "feed"
FIELD_STATUS = "status"
FIELD_STARRED = "starred"
FIELD_SEARCH = "search"
FIELD_PUBLISHED_WITHIN = "published_within"
FIELD_PUBLISHED_AFTER = "published_after"
FIELD_PUBLISHED_BEFORE = "published_before"
FIELD_ORDER = "order"
FIELD_DIRECTION = "direction"
FIELD_LIMIT = "limit"
FIELD_INCLUDE_CONTENT = "include_content"
FIELD_ENTRY_IDS = "entry_ids"
FIELD_ONLY_WITH_ERRORS = "only_with_errors"

_COMMON_FILTER_FIELDS: dict[Any, Any] = {
    vol.Optional(FIELD_CATEGORY): vol.Any(cv.positive_int, cv.string),
    vol.Optional(FIELD_FEED): vol.Any(cv.positive_int, cv.string),
    vol.Optional(FIELD_STATUS): vol.All(cv.ensure_list, [vol.In(ENTRY_STATUSES)]),
    vol.Optional(FIELD_STARRED): cv.boolean,
    vol.Optional(FIELD_SEARCH): cv.string,
    vol.Optional(FIELD_PUBLISHED_WITHIN): cv.positive_time_period_dict,
    vol.Optional(FIELD_PUBLISHED_AFTER): cv.datetime,
    vol.Optional(FIELD_PUBLISHED_BEFORE): cv.datetime,
    vol.Optional(FIELD_ORDER): cv.string,
    vol.Optional(FIELD_DIRECTION): vol.In(("asc", "desc")),
}

SEARCH_ENTRIES_SCHEMA = vol.Schema(
    {
        vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
        **_COMMON_FILTER_FIELDS,
        vol.Optional(FIELD_LIMIT, default=SEARCH_LIMIT_DEFAULT): vol.All(
            int, vol.Range(min=1, max=SEARCH_LIMIT_MAX)
        ),
        vol.Optional(FIELD_INCLUDE_CONTENT, default=False): cv.boolean,
    }
)

COUNT_ENTRIES_SCHEMA = vol.Schema(
    {
        vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
        **_COMMON_FILTER_FIELDS,
    }
)

GET_ENTRIES_SCHEMA = vol.Schema(
    {
        vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
        vol.Required(FIELD_ENTRY_IDS): vol.All(cv.ensure_list, [cv.positive_int]),
        vol.Optional(FIELD_INCLUDE_CONTENT, default=True): cv.boolean,
    }
)

GET_FEEDS_SCHEMA = vol.Schema(
    {
        vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
        vol.Optional(FIELD_CATEGORY): vol.Any(cv.positive_int, cv.string),
        vol.Optional(FIELD_ONLY_WITH_ERRORS, default=False): cv.boolean,
    }
)

FIELD_EVERYTHING = "everything"

# Declarative mutation over an explicit id set (D8, §4 Rule 2): at least one
# of status/starred required, or there's nothing to do.
UPDATE_ENTRIES_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
            vol.Required(FIELD_ENTRY_IDS): vol.All(cv.ensure_list, [cv.positive_int]),
            vol.Optional(FIELD_STATUS): vol.In(ENTRY_STATUSES),
            vol.Optional(FIELD_STARRED): cv.boolean,
        }
    ),
    cv.has_at_least_one_key(FIELD_STATUS, FIELD_STARRED),
)

# Scope-level mutation, kept as a separate service from update_entries
# (§4 Rule 2 blast-radius separation): exactly one scope, never zero, never
# more than one -- `everything` must be literally True (the literal-value
# schema entry rejects `everything: false` outright rather than needing a
# handler-level special case for a value that would mean "no scope chosen").
MARK_ALL_READ_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
            vol.Optional(FIELD_FEED): vol.Any(cv.positive_int, cv.string),
            vol.Optional(FIELD_CATEGORY): vol.Any(cv.positive_int, cv.string),
            vol.Optional(FIELD_EVERYTHING): True,
        }
    ),
    cv.has_at_least_one_key(FIELD_FEED, FIELD_CATEGORY, FIELD_EVERYTHING),
    cv.has_at_most_one_key(FIELD_FEED, FIELD_CATEGORY, FIELD_EVERYTHING),
)

# --- Admin family (architecture §4 Rule 3: one service per verb, honest
# static schemas -- an action-enum service can't express "feed_url required
# on create, optional on update" without runtime string checks). ---

FIELD_FEED_URL = "feed_url"
FIELD_CRAWLER = "crawler"
FIELD_TITLE = "title"
FIELD_DISABLED = "disabled"
FIELD_URL = "url"
FIELD_OPML = "opml"

CREATE_FEED_SCHEMA = vol.Schema(
    {
        vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
        vol.Required(FIELD_FEED_URL): cv.string,
        vol.Optional(FIELD_CATEGORY): vol.Any(cv.positive_int, cv.string),
        vol.Optional(FIELD_CRAWLER): cv.boolean,
    }
)

UPDATE_FEED_SCHEMA = vol.Schema(
    {
        vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
        vol.Required(FIELD_FEED): vol.Any(cv.positive_int, cv.string),
        vol.Optional(FIELD_TITLE): cv.string,
        vol.Optional(FIELD_CATEGORY): vol.Any(cv.positive_int, cv.string),
        vol.Optional(FIELD_FEED_URL): cv.string,
        vol.Optional(FIELD_DISABLED): cv.boolean,
        vol.Optional(FIELD_CRAWLER): cv.boolean,
    }
)

# Destructive verb, isolated in its own service with its own honest schema
# (feed only -- no bulk, no confusable extra fields).
DELETE_FEED_SCHEMA = vol.Schema(
    {
        vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
        vol.Required(FIELD_FEED): vol.Any(cv.positive_int, cv.string),
    }
)

REFRESH_FEED_SCHEMA = vol.Schema(
    {
        vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
        vol.Required(FIELD_FEED): vol.Any(cv.positive_int, cv.string),
    }
)

# Deliberately has no `feed` field at all -- refresh_feed and
# refresh_all_feeds (§4 Rule 2 blast-radius separation) can never be
# confused for one another by a missing/extra argument.
REFRESH_ALL_FEEDS_SCHEMA = vol.Schema({vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string})

DISCOVER_FEEDS_SCHEMA = vol.Schema(
    {
        vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
        vol.Required(FIELD_URL): cv.string,
    }
)

CREATE_CATEGORY_SCHEMA = vol.Schema(
    {
        vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
        vol.Required(FIELD_TITLE): cv.string,
    }
)

UPDATE_CATEGORY_SCHEMA = vol.Schema(
    {
        vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
        vol.Required(FIELD_CATEGORY): vol.Any(cv.positive_int, cv.string),
        vol.Required(FIELD_TITLE): cv.string,
    }
)

DELETE_CATEGORY_SCHEMA = vol.Schema(
    {
        vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
        vol.Required(FIELD_CATEGORY): vol.Any(cv.positive_int, cv.string),
    }
)

EXPORT_OPML_SCHEMA = vol.Schema({vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string})

IMPORT_OPML_SCHEMA = vol.Schema(
    {
        vol.Optional(FIELD_CONFIG_ENTRY_ID): cv.string,
        vol.Required(FIELD_OPML): cv.string,
    }
)


def _resolve_entry(hass: HomeAssistant, config_entry_id: str | None) -> ConfigEntry:
    """The targeting helper (architecture §3.3 targeting convention): single
    configured entry auto-resolves; multiple requires an explicit id."""
    entries = hass.config_entries.async_entries(DOMAIN)

    if config_entry_id is not None:
        for entry in entries:
            if entry.entry_id == config_entry_id:
                return entry
        raise ServiceValidationError(f"Unknown config_entry_id: {config_entry_id!r}")

    if len(entries) == 1:
        return entries[0]
    if not entries:
        raise ServiceValidationError("No Miniflux instance is configured")
    raise ServiceValidationError(
        "Multiple Miniflux instances are configured; specify config_entry_id"
    )


async def _run(coro: Coroutine[Any, Any, Any]) -> Any:
    """Wraps a client call: Miniflux/transport failures become
    HomeAssistantError carrying the mapped user message (D10) -- caller-
    mistake validation (FilterError etc.) is converted to
    ServiceValidationError at its own call site, before this is ever
    reached, since that validation is pure/sync and happens pre-HTTP."""
    try:
        return await coro
    except errors.MinifluxError as err:
        raise HomeAssistantError(errors.user_message(err)) from err


def _build_entry_filter(data: dict[str, Any]) -> EntryFilter:
    kwargs: dict[str, Any] = {}
    for field, kwarg in (
        (FIELD_CATEGORY, "category"),
        (FIELD_FEED, "feed"),
        (FIELD_STARRED, "starred"),
        (FIELD_SEARCH, "search"),
        (FIELD_PUBLISHED_WITHIN, "published_within"),
        (FIELD_PUBLISHED_AFTER, "published_after"),
        (FIELD_PUBLISHED_BEFORE, "published_before"),
        (FIELD_ORDER, "order"),
        (FIELD_DIRECTION, "direction"),
        (FIELD_LIMIT, "limit"),
    ):
        if field in data:
            kwargs[kwarg] = data[field]
    if FIELD_STATUS in data:
        kwargs["status"] = tuple(data[FIELD_STATUS])
    return EntryFilter(**kwargs)


def _resolve_filter_and_params(
    entry_filter: EntryFilter, snapshot, now
) -> tuple[ResolvedFilter, dict[str, Any]]:
    """validate() + resolve_refs() + to_query_params() in one place: every
    pure, pre-HTTP validation step a query service needs, with both error
    types that step can raise (FilterError, and TimeParseError from a naive
    published_after/_before that slipped past schema validation) converted
    to ServiceValidationError."""
    try:
        entry_filter.validate()
        resolved = resolve_refs(entry_filter, snapshot)
        params = to_query_params(resolved, now)
    except (FilterError, TimeParseError) as err:
        raise ServiceValidationError(str(err)) from err
    return resolved, params


def _entry_to_dict(entry: Entry, *, include_content: bool) -> dict[str, Any]:
    data = {
        "id": entry.id,
        "feed_id": entry.feed_id,
        "feed_title": entry.feed_title,
        "category_id": entry.category_id,
        "category_title": entry.category_title,
        "title": entry.title,
        "url": entry.url,
        "author": entry.author,
        "published_at": entry.published_at.isoformat(),
        "changed_at": entry.changed_at.isoformat(),
        "status": entry.status,
        "starred": entry.starred,
        "reading_time": entry.reading_time,
        "tags": list(entry.tags),
    }
    if include_content:
        data["content"] = entry.content
    return data


def _feed_to_dict(feed: Feed) -> dict[str, Any]:
    return {
        "id": feed.id,
        "title": feed.title,
        "site_url": feed.site_url,
        "feed_url": feed.feed_url,
        "category_id": feed.category_id,
        "category_title": feed.category_title,
        "checked_at": feed.checked_at.isoformat() if feed.checked_at else None,
        "parsing_error_count": feed.parsing_error_count,
        "parsing_error_message": feed.parsing_error_message,
        "disabled": feed.disabled,
    }


async def _handle_search_entries(call: ServiceCall) -> dict[str, Any]:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    coordinator = entry.runtime_data.coordinator
    client = entry.runtime_data.client

    entry_filter = _build_entry_filter(call.data)
    resolved, params = _resolve_filter_and_params(entry_filter, coordinator.data, dt_util.utcnow())

    include_content = call.data[FIELD_INCLUDE_CONTENT]
    total, entries = await _run(client.query_entries(params, limit=resolved.limit))

    return {
        "total": total,
        "count": len(entries),
        "entries": [_entry_to_dict(e, include_content=include_content) for e in entries],
    }


async def _handle_count_entries(call: ServiceCall) -> dict[str, Any]:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    coordinator = entry.runtime_data.coordinator
    client = entry.runtime_data.client

    entry_filter = _build_entry_filter(call.data)
    _resolved, params = _resolve_filter_and_params(entry_filter, coordinator.data, dt_util.utcnow())

    total = await _run(client.count_entries(params))
    return {"total": total}


async def _handle_get_entries(call: ServiceCall) -> dict[str, Any]:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client

    entry_ids = call.data[FIELD_ENTRY_IDS]
    try:
        validate_entry_ids(entry_ids, max_count=HYDRATE_IDS_MAX)
    except FilterError as err:
        raise ServiceValidationError(str(err)) from err

    include_content = call.data[FIELD_INCLUDE_CONTENT]
    entries, missing = await _run(client.get_entries_by_id(entry_ids))

    return {
        "entries": [_entry_to_dict(e, include_content=include_content) for e in entries],
        "missing": missing,
    }


async def _handle_get_feeds(call: ServiceCall) -> dict[str, Any]:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client
    coordinator = entry.runtime_data.coordinator

    category_ref = call.data.get(FIELD_CATEGORY)
    category_id = (
        _resolve_category_ref(category_ref, coordinator.data) if category_ref is not None else None
    )

    feeds = await _run(client.get_feeds())

    if category_id is not None:
        feeds = [f for f in feeds if f.category_id == category_id]
    if call.data[FIELD_ONLY_WITH_ERRORS]:
        feeds = [f for f in feeds if f.parsing_error_count > 0]

    return {"feeds": [_feed_to_dict(f) for f in feeds]}


def _resolve_category_ref(ref: int | str, snapshot) -> int:
    """Shared by get_feeds and mark_all_read -- reuses filters.resolve_refs
    rather than re-implementing title/ambiguity resolution a second time."""
    try:
        resolved = resolve_refs(EntryFilter(category=ref), snapshot)
    except FilterError as err:
        raise ServiceValidationError(str(err)) from err
    return resolved.category_id


def _resolve_feed_ref(ref: int | str, snapshot) -> int:
    try:
        resolved = resolve_refs(EntryFilter(feed=ref), snapshot)
    except FilterError as err:
        raise ServiceValidationError(str(err)) from err
    return resolved.feed_id


async def _handle_update_entries(call: ServiceCall) -> dict[str, Any]:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client
    coordinator = entry.runtime_data.coordinator

    entry_ids = call.data[FIELD_ENTRY_IDS]
    try:
        validate_entry_ids(entry_ids, max_count=UPDATE_IDS_MAX)
    except FilterError as err:
        raise ServiceValidationError(str(err)) from err

    if FIELD_STATUS in call.data:
        await _run(client.set_entries_status(entry_ids, call.data[FIELD_STATUS]))
    if FIELD_STARRED in call.data:
        await _run(client.set_entries_starred(entry_ids, call.data[FIELD_STARRED]))

    # Keeps sensors from lying until the next poll (architecture §2.1/§2.2).
    await coordinator.async_request_refresh()

    return {"updated": len(entry_ids)}


async def _handle_mark_all_read(call: ServiceCall) -> None:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client
    coordinator = entry.runtime_data.coordinator

    if FIELD_FEED in call.data:
        feed_id = _resolve_feed_ref(call.data[FIELD_FEED], coordinator.data)
        await _run(client.mark_feed_read(feed_id))
    elif FIELD_CATEGORY in call.data:
        category_id = _resolve_category_ref(call.data[FIELD_CATEGORY], coordinator.data)
        await _run(client.mark_category_read(category_id))
    else:
        await _run(client.mark_all_read())

    await coordinator.async_request_refresh()


async def _handle_create_feed(call: ServiceCall) -> dict[str, Any]:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client
    coordinator = entry.runtime_data.coordinator

    kwargs: dict[str, Any] = {}
    if FIELD_CATEGORY in call.data:
        kwargs["category_id"] = _resolve_category_ref(call.data[FIELD_CATEGORY], coordinator.data)
    if FIELD_CRAWLER in call.data:
        kwargs["crawler"] = call.data[FIELD_CRAWLER]

    feed_id = await _run(client.create_feed(call.data[FIELD_FEED_URL], **kwargs))
    await coordinator.async_request_refresh()
    return {"feed_id": feed_id}


async def _handle_update_feed(call: ServiceCall) -> None:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client
    coordinator = entry.runtime_data.coordinator

    feed_id = _resolve_feed_ref(call.data[FIELD_FEED], coordinator.data)

    fields: dict[str, Any] = {}
    if FIELD_TITLE in call.data:
        fields["title"] = call.data[FIELD_TITLE]
    if FIELD_CATEGORY in call.data:
        fields["category_id"] = _resolve_category_ref(call.data[FIELD_CATEGORY], coordinator.data)
    if FIELD_FEED_URL in call.data:
        fields["feed_url"] = call.data[FIELD_FEED_URL]
    if FIELD_DISABLED in call.data:
        fields["disabled"] = call.data[FIELD_DISABLED]
    if FIELD_CRAWLER in call.data:
        fields["crawler"] = call.data[FIELD_CRAWLER]

    await _run(client.update_feed(feed_id, **fields))
    await coordinator.async_request_refresh()


async def _handle_delete_feed(call: ServiceCall) -> None:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client
    coordinator = entry.runtime_data.coordinator

    feed_id = _resolve_feed_ref(call.data[FIELD_FEED], coordinator.data)
    await _run(client.delete_feed(feed_id))
    await coordinator.async_request_refresh()


async def _handle_refresh_feed(call: ServiceCall) -> None:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client
    coordinator = entry.runtime_data.coordinator

    feed_id = _resolve_feed_ref(call.data[FIELD_FEED], coordinator.data)
    await _run(client.refresh_feed(feed_id))
    await coordinator.async_request_refresh()


async def _handle_refresh_all_feeds(call: ServiceCall) -> None:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client
    coordinator = entry.runtime_data.coordinator

    await _run(client.refresh_all_feeds())
    await coordinator.async_request_refresh()


async def _handle_discover_feeds(call: ServiceCall) -> dict[str, Any]:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client
    candidates = await _run(client.discover(call.data[FIELD_URL]))
    return {"feeds": candidates}


async def _handle_create_category(call: ServiceCall) -> dict[str, Any]:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client
    category_id = await _run(client.create_category(call.data[FIELD_TITLE]))
    return {"category_id": category_id}


async def _handle_update_category(call: ServiceCall) -> None:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client
    coordinator = entry.runtime_data.coordinator
    category_id = _resolve_category_ref(call.data[FIELD_CATEGORY], coordinator.data)
    await _run(client.update_category(category_id, call.data[FIELD_TITLE]))


async def _handle_delete_category(call: ServiceCall) -> None:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client
    coordinator = entry.runtime_data.coordinator
    category_id = _resolve_category_ref(call.data[FIELD_CATEGORY], coordinator.data)
    await _run(client.delete_category(category_id))


async def _handle_export_opml(call: ServiceCall) -> dict[str, Any]:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client
    opml = await _run(client.export_opml())
    return {"opml": opml}


async def _handle_import_opml(call: ServiceCall) -> None:
    entry = _resolve_entry(call.hass, call.data.get(FIELD_CONFIG_ENTRY_ID))
    client = entry.runtime_data.client
    await _run(client.import_opml(call.data[FIELD_OPML]))


def async_register_services(hass: HomeAssistant) -> None:
    """Idempotent: safe to call once per config-entry setup even with
    multiple entries, since services are process-global, not per-entry."""
    if hass.services.has_service(DOMAIN, SERVICE_SEARCH_ENTRIES):
        return

    hass.services.async_register(
        DOMAIN,
        SERVICE_SEARCH_ENTRIES,
        _handle_search_entries,
        schema=SEARCH_ENTRIES_SCHEMA,
        supports_response=SupportsResponse.ONLY,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_COUNT_ENTRIES,
        _handle_count_entries,
        schema=COUNT_ENTRIES_SCHEMA,
        supports_response=SupportsResponse.ONLY,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_GET_ENTRIES,
        _handle_get_entries,
        schema=GET_ENTRIES_SCHEMA,
        supports_response=SupportsResponse.ONLY,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_GET_FEEDS,
        _handle_get_feeds,
        schema=GET_FEEDS_SCHEMA,
        supports_response=SupportsResponse.ONLY,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_UPDATE_ENTRIES,
        _handle_update_entries,
        schema=UPDATE_ENTRIES_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_MARK_ALL_READ,
        _handle_mark_all_read,
        schema=MARK_ALL_READ_SCHEMA,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_CREATE_FEED,
        _handle_create_feed,
        schema=CREATE_FEED_SCHEMA,
        supports_response=SupportsResponse.ONLY,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_UPDATE_FEED,
        _handle_update_feed,
        schema=UPDATE_FEED_SCHEMA,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_DELETE_FEED,
        _handle_delete_feed,
        schema=DELETE_FEED_SCHEMA,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_REFRESH_FEED,
        _handle_refresh_feed,
        schema=REFRESH_FEED_SCHEMA,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_REFRESH_ALL_FEEDS,
        _handle_refresh_all_feeds,
        schema=REFRESH_ALL_FEEDS_SCHEMA,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_DISCOVER_FEEDS,
        _handle_discover_feeds,
        schema=DISCOVER_FEEDS_SCHEMA,
        supports_response=SupportsResponse.ONLY,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_CREATE_CATEGORY,
        _handle_create_category,
        schema=CREATE_CATEGORY_SCHEMA,
        supports_response=SupportsResponse.ONLY,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_UPDATE_CATEGORY,
        _handle_update_category,
        schema=UPDATE_CATEGORY_SCHEMA,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_DELETE_CATEGORY,
        _handle_delete_category,
        schema=DELETE_CATEGORY_SCHEMA,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_EXPORT_OPML,
        _handle_export_opml,
        schema=EXPORT_OPML_SCHEMA,
        supports_response=SupportsResponse.ONLY,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_IMPORT_OPML,
        _handle_import_opml,
        schema=IMPORT_OPML_SCHEMA,
    )
