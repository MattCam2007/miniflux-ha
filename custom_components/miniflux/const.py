"""Single source of truth for domain strings, event names, and tunable caps.

Framework-free by design (seam rule 5, plans/00-overview.md §4): no
``homeassistant`` import here, so this module is importable by plain
``pytest`` with no HA installed.

Values marked ``# ASSUMED (R1)`` are best-guesses against latest Miniflux,
recorded in ``plans/decisions-and-assumed-contract.md``. They are gathered
here (and in ``normalize.py``/``api.py``) specifically so the morning
contract-pinning pass (``plans/r1-contract-pinning.md``) is a one-file diff.
"""

from __future__ import annotations

DOMAIN = "miniflux"

# --- Config / options entry keys -------------------------------------------------
CONF_URL = "url"
CONF_API_KEY = "api_key"
CONF_VERIFY_SSL = "verify_ssl"
CONF_WEBHOOK_ID = "webhook_id"
CONF_WEBHOOK_SECRET = "webhook_secret"
CONF_SCAN_INTERVAL = "scan_interval"
CONF_LOCAL_ONLY = "local_only"

# --- HA event types (public automation contract, architecture §3.5) --------------
EVENT_NEW_ENTRIES = "miniflux_new_entries"
EVENT_ENTRY_SAVED = "miniflux_entry_saved"
EVENT_FEED_ERROR = "miniflux_feed_error"
EVENT_FEED_RECOVERED = "miniflux_feed_recovered"

# --- Service names -----------------------------------------------------------------
SERVICE_SEARCH_ENTRIES = "search_entries"
SERVICE_COUNT_ENTRIES = "count_entries"
SERVICE_GET_ENTRIES = "get_entries"
SERVICE_GET_FEEDS = "get_feeds"
SERVICE_UPDATE_ENTRIES = "update_entries"
SERVICE_MARK_ALL_READ = "mark_all_read"
SERVICE_CREATE_FEED = "create_feed"
SERVICE_UPDATE_FEED = "update_feed"
SERVICE_DELETE_FEED = "delete_feed"
SERVICE_REFRESH_FEED = "refresh_feed"
SERVICE_REFRESH_ALL_FEEDS = "refresh_all_feeds"
SERVICE_DISCOVER_FEEDS = "discover_feeds"
SERVICE_CREATE_CATEGORY = "create_category"
SERVICE_UPDATE_CATEGORY = "update_category"
SERVICE_DELETE_CATEGORY = "delete_category"
SERVICE_EXPORT_OPML = "export_opml"
SERVICE_IMPORT_OPML = "import_opml"

# --- Caps & defaults (R5 — every tunable constant lives here, nowhere else) -------
DEFAULT_SCAN_INTERVAL = 300
MIN_SCAN_INTERVAL = 60
EVENT_ENTRIES_CAP = 50
ERROR_FEEDS_ATTR_CAP = 25
BY_CATEGORY_ATTR_CAP = 100
SEARCH_LIMIT_DEFAULT = 100
SEARCH_LIMIT_MAX = 500
HYDRATE_IDS_MAX = 100
UPDATE_IDS_MAX = 500
WEBHOOK_MAX_BODY_BYTES = 10_485_760  # 10 MiB
REFRESH_DEBOUNCE_SECONDS = 10
TITLE_TRUNCATE = 256
API_CONCURRENCY = 4
API_TIMEOUT_SECONDS = 30
API_GET_RETRY_DELAY_SECONDS = 0.5

# --- Assumed Miniflux wire contract (plans/decisions-and-assumed-contract.md) ----
# ASSUMED (R1): API-key auth header name.
API_AUTH_HEADER = "X-Auth-Token"

# ASSUMED (R1): version endpoint; falls back to ROOT if V1 404s.
API_VERSION_PATH_V1 = "/v1/version"
API_VERSION_PATH_ROOT = "/version"

API_PATH_ME = "/v1/me"
API_PATH_FEEDS = "/v1/feeds"
API_PATH_FEED_COUNTERS = "/v1/feeds/counters"  # ASSUMED (R1): presence
API_PATH_CATEGORIES = "/v1/categories"
API_PATH_ENTRIES = "/v1/entries"
API_PATH_DISCOVER = "/v1/discover"
API_PATH_EXPORT = "/v1/export"
API_PATH_IMPORT = "/v1/import"
API_PATH_USERS = "/v1/users"

# ASSUMED (R1): published-date filter param names + unit (unix epoch seconds).
PARAM_PUBLISHED_AFTER = "published_after"
PARAM_PUBLISHED_BEFORE = "published_before"

# ASSUMED (R1): webhook signature + event-type header names.
WEBHOOK_HEADER_SIGNATURE = "X-Miniflux-Signature"
WEBHOOK_HEADER_EVENT_TYPE = "X-Miniflux-Event-Type"

# ASSUMED (R1): signature is hex-encoded HMAC-SHA256 over the raw request body.
WEBHOOK_SIGNATURE_ENCODING = "hex"

WEBHOOK_EVENT_TYPE_NEW_ENTRIES = "new_entries"
WEBHOOK_EVENT_TYPE_SAVE_ENTRY = "save_entry"

ENTRY_STATUS_UNREAD = "unread"
ENTRY_STATUS_READ = "read"
ENTRY_STATUS_REMOVED = "removed"
ENTRY_STATUSES = (ENTRY_STATUS_UNREAD, ENTRY_STATUS_READ, ENTRY_STATUS_REMOVED)
