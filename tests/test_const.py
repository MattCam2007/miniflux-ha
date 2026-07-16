"""Chunk 0.5 — const.py is the single source of truth for domain strings and caps.

Guards against accidental renames of the public event-name contract
(architecture §3.5 — automations key off these exact strings) and against
caps drifting out of the documented relationships (R5).
"""

from __future__ import annotations

from custom_components.miniflux import const


def test_domain_is_miniflux():
    assert const.DOMAIN == "miniflux"


def test_event_names_match_public_contract():
    """These exact strings are the public automation surface (architecture §3.5)."""
    assert const.EVENT_NEW_ENTRIES == "miniflux_new_entries"
    assert const.EVENT_ENTRY_SAVED == "miniflux_entry_saved"
    assert const.EVENT_FEED_ERROR == "miniflux_feed_error"
    assert const.EVENT_FEED_RECOVERED == "miniflux_feed_recovered"


def test_all_event_names_share_domain_prefix():
    events = [
        const.EVENT_NEW_ENTRIES,
        const.EVENT_ENTRY_SAVED,
        const.EVENT_FEED_ERROR,
        const.EVENT_FEED_RECOVERED,
    ]
    assert len(events) == len(set(events)), "event names must be unique"
    for event in events:
        assert event.startswith("miniflux_")


def test_scan_interval_relationship():
    assert const.MIN_SCAN_INTERVAL <= const.DEFAULT_SCAN_INTERVAL


def test_search_limit_relationship():
    assert const.SEARCH_LIMIT_DEFAULT <= const.SEARCH_LIMIT_MAX


def test_caps_are_positive_ints():
    caps = [
        const.EVENT_ENTRIES_CAP,
        const.ERROR_FEEDS_ATTR_CAP,
        const.BY_CATEGORY_ATTR_CAP,
        const.SEARCH_LIMIT_DEFAULT,
        const.SEARCH_LIMIT_MAX,
        const.HYDRATE_IDS_MAX,
        const.UPDATE_IDS_MAX,
        const.WEBHOOK_MAX_BODY_BYTES,
        const.REFRESH_DEBOUNCE_SECONDS,
        const.TITLE_TRUNCATE,
        const.API_CONCURRENCY,
        const.API_TIMEOUT_SECONDS,
    ]
    for cap in caps:
        assert isinstance(cap, int) and cap > 0


def test_entry_statuses_tuple_matches_individual_constants():
    assert const.ENTRY_STATUSES == (
        const.ENTRY_STATUS_UNREAD,
        const.ENTRY_STATUS_READ,
        const.ENTRY_STATUS_REMOVED,
    )


def test_webhook_signature_encoding_is_hex():
    """ASSUMED (R1) — flip this test the morning the checklist says otherwise."""
    assert const.WEBHOOK_SIGNATURE_ENCODING == "hex"


def test_service_names_are_unique():
    service_names = [v for k, v in vars(const).items() if k.startswith("SERVICE_")]
    assert len(service_names) == len(set(service_names))
    assert len(service_names) >= 15  # query + mutation + admin families
