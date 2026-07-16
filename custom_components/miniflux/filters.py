"""EntryFilter: the shared query contract behind search_entries/count_entries
(architecture §3.3, §4 Rule 1). Pure — resolve_refs takes a Snapshot for
title resolution rather than calling the API.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from . import timeutil
from .const import ENTRY_STATUSES, SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX
from .models import Snapshot


class FilterError(ValueError):
    """Raised on invalid filter combinations or unresolvable title references."""


@dataclass(frozen=True, slots=True)
class EntryFilter:
    """Caller-facing filter spec. category/feed may be a numeric id or an
    exact title string (resolved against a Snapshot by resolve_refs)."""

    category: int | str | None = None
    feed: int | str | None = None
    status: tuple[str, ...] = ("unread",)
    starred: bool | None = None
    search: str | None = None
    published_within: timedelta | None = None
    published_after: datetime | None = None
    published_before: datetime | None = None
    order: str | None = None
    direction: str | None = None
    limit: int = SEARCH_LIMIT_DEFAULT

    def validate(self) -> None:
        if self.published_within is not None and (
            self.published_after is not None or self.published_before is not None
        ):
            raise FilterError(
                "published_within cannot be combined with published_after/published_before"
            )
        if self.limit < 1 or self.limit > SEARCH_LIMIT_MAX:
            raise FilterError(f"limit must be between 1 and {SEARCH_LIMIT_MAX}, got {self.limit}")
        for status in self.status:
            if status not in ENTRY_STATUSES:
                raise FilterError(f"unknown status: {status!r} (expected one of {ENTRY_STATUSES})")


@dataclass(frozen=True, slots=True)
class ResolvedFilter:
    """EntryFilter with category/feed titles resolved to numeric ids."""

    category_id: int | None
    feed_id: int | None
    status: tuple[str, ...]
    starred: bool | None
    search: str | None
    published_within: timedelta | None
    published_after: datetime | None
    published_before: datetime | None
    order: str | None
    direction: str | None
    limit: int


def resolve_refs(entry_filter: EntryFilter, snapshot: Snapshot) -> ResolvedFilter:
    return ResolvedFilter(
        category_id=_resolve_category(entry_filter.category, snapshot),
        feed_id=_resolve_feed(entry_filter.feed, snapshot),
        status=entry_filter.status,
        starred=entry_filter.starred,
        search=entry_filter.search,
        published_within=entry_filter.published_within,
        published_after=entry_filter.published_after,
        published_before=entry_filter.published_before,
        order=entry_filter.order,
        direction=entry_filter.direction,
        limit=entry_filter.limit,
    )


def _resolve_category(ref: int | str | None, snapshot: Snapshot) -> int | None:
    if ref is None or isinstance(ref, int):
        return ref
    # Dedupe by category_id: multiple feeds in the same category share a title
    # legitimately and must not look ambiguous. Only *distinct* category ids
    # sharing a title are genuinely ambiguous.
    matching_ids = {
        feed.category_id
        for feed in snapshot.feeds
        if feed.category_title == ref and feed.category_id is not None
    }
    if not matching_ids:
        raise FilterError(f"unknown category: {ref!r}")
    if len(matching_ids) > 1:
        raise FilterError(f"ambiguous category title: {ref!r} matches multiple categories")
    return next(iter(matching_ids))


def _resolve_feed(ref: int | str | None, snapshot: Snapshot) -> int | None:
    if ref is None or isinstance(ref, int):
        return ref
    matching_ids = [feed.id for feed in snapshot.feeds if feed.title == ref]
    if not matching_ids:
        raise FilterError(f"unknown feed: {ref!r}")
    if len(matching_ids) > 1:
        raise FilterError(f"ambiguous feed title: {ref!r} matches multiple feeds")
    return matching_ids[0]


def to_query_params(resolved: ResolvedFilter, now: datetime) -> dict[str, object]:
    """Build the query-param dict api.py sends to Miniflux.

    Multi-valued fields (``status``) are returned as a list; api.py is
    responsible for expanding list values into repeated query-string keys —
    that HTTP-encoding detail belongs with the rest of the request mechanics,
    not here.
    """
    params: dict[str, object] = {}
    if resolved.category_id is not None:
        params["category_id"] = resolved.category_id
    if resolved.feed_id is not None:
        params["feed_id"] = resolved.feed_id
    if resolved.status:
        params["status"] = list(resolved.status)
    if resolved.starred is not None:
        params["starred"] = resolved.starred
    if resolved.search:
        params["search"] = resolved.search

    if resolved.published_within is not None:
        bound = timeutil.window_to_bounds(now, resolved.published_within)
        params["published_after"] = timeutil.to_filter_param(bound)
    if resolved.published_after is not None:
        params["published_after"] = timeutil.to_filter_param(resolved.published_after)
    if resolved.published_before is not None:
        params["published_before"] = timeutil.to_filter_param(resolved.published_before)

    if resolved.order:
        params["order"] = resolved.order
    if resolved.direction:
        params["direction"] = resolved.direction

    params["limit"] = resolved.limit
    return params


def validate_entry_ids(entry_ids: Sequence[int], *, max_count: int) -> None:
    """Shared validator for the id-list services (get_entries/update_entries,
    Phase 5) — kept here so services validate via pure functions, not inline
    HTTP-adjacent checks (seam rule 2)."""
    if not entry_ids:
        raise FilterError("entry_ids must not be empty")
    if len(entry_ids) > max_count:
        raise FilterError(f"entry_ids exceeds max of {max_count} (got {len(entry_ids)})")
