# Phase 2 — API Client (`api.py`)

**Goal:** the one async aiohttp client that talks to Miniflux. It injects auth, joins sub-path base URLs, enforces timeout + concurrency, maps HTTP failures to the Phase-1 typed errors, retries idempotent GETs once, never retries mutations, walks pagination, and returns Phase-1 models. **All HTTP and all Miniflux field-name knowledge live here (+ `normalize.py`).** Nothing else in the codebase imports aiohttp.

**Depends on:** Phase 1 (models, normalize, filters, errors, timeutil), Phase 0 (`const`).
**Produces:** `api.py`.
**Tested with:** `aioclient_mock`/`aioresponses` over `tests/fixtures/` **raw** bodies — zero live sockets.
**Architecture refs:** §3.1 (endpoints + error mapping + retry + concurrency + time), D6 (embedded client), D7 (pagination), D8 (declarative star), R1 (wire pinning), R9 (sub-path/topology).

**R1 gate:** before freezing this phase, run the contract-pinning task against the real Miniflux instance and refresh `tests/fixtures/` + any header/param/path constants. This phase's tests are written against those fixtures; if a shape differs, fix the fixture and the mapping here — the blast radius is intentionally this module.

Build 2.1 first (it's the request core every other chunk rides on), then 2.2–2.5 in order.

---

## Chunk 2.1 — Request core

**Purpose:** the private request path all endpoints share.

**Public/typed surface:**
- `MinifluxClient(session: aiohttp.ClientSession, base_url: str, api_key: str, *, verify_ssl=True, timeout=API_TIMEOUT_SECONDS, concurrency=API_CONCURRENCY)`. Uses HA's shared session (passed in — never creates its own; keeps tests and prod on one path).
- private `_request(method, path, *, params=None, json=None) -> parsed JSON` that:
  - joins `path` onto `base_url` **preserving any sub-path** (R9) — `https://host/miniflux` + `/v1/feeds` → `.../miniflux/v1/feeds`.
  - sets the API-key auth header (exact header name pinned R1, constant in `const`/here).
  - applies `timeout`; acquires the concurrency `asyncio.Semaphore` (≤ `API_CONCURRENCY` in flight).
  - on non-2xx → `errors.map_http_error(status, body)`.
  - on `aiohttp`/timeout/DNS/TLS exceptions → `MinifluxConnectionError`.
  - **retry policy:** idempotent methods (GET) retried **once** after short jittered delay on connection error / 5xx; mutations (PUT/POST/DELETE) **never** retried (D10; a re-run is the caller's safe retry).

**Tests first (red):** via mocked client:
- auth header present and correct on every request.
- sub-path base URL joins correctly (parametrized: with and without trailing slash, with and without sub-path) (R9).
- 401 → `MinifluxAuthError`; 404 → `NotFound`; 400 w/ body message → `BadRequest` carrying it; 500 → `ServerError`; timeout/connection → `ConnectionError`.
- a GET that fails once then succeeds → one retry, returns data; a GET that fails twice → raises after one retry.
- a PUT that fails once → raises immediately (no retry).
- concurrency: launch N>concurrency simultaneous calls against a gated mock → at most `API_CONCURRENCY` in flight (assert via a counting mock).
- `verify_ssl=False` is threaded to the request (self-signed path, R9).

**DoD:** ≥95%; every error branch and both retry rules covered.

---

## Chunk 2.2 — Read endpoints (identity, feeds, counters, version)

**Purpose:** the cheap aggregate reads the coordinator polls (architecture §2.3 step 1).

**Public surface:**
- `async get_me() -> {id, username, ...}` — used by config flow for validation + unique id (R10).
- `async get_version() -> str` — device `sw_version`; tolerate older instances lacking `/v1/version` (fall back / return `None`, R1).
- `async get_feeds() -> list[Feed]` (via `normalize.feed_from_json`).
- `async get_feed_counters() -> CountersRaw` — the `{reads, unreads}` maps (`/v1/feeds/counters`; confirm availability R1).

**Tests first (red):**
- each returns correctly-typed models from fixtures.
- `get_feeds` includes a parsing-error feed with count/message and an uncategorized feed.
- `get_version` missing-endpoint fixture → graceful fallback, no raise.
- errors propagate as Phase-1 types (401 on `get_me` → `AuthError`).

**DoD:** ≥95%; feeds/counters fixtures match what `rollup.build_snapshot` expects (cross-checked by a small integration-of-pure test: fixtures → api parse → rollup → snapshot).

---

## Chunk 2.3 — Entries query + pagination

**Purpose:** the query surface behind `search_entries`/`count_entries`/scoped variants (architecture §3.3, D7).

**Public surface:**
- `async query_entries(params: dict, *, limit: int) -> tuple[total:int, entries:list[Entry]]` — issues `GET /v1/entries` with the param dict from `filters.to_query_params`, **walks limit/offset pages internally** until `limit` reached or Miniflux exhausted, returns Miniflux's `total` and the accumulated entries. `include_content` toggles the content-bearing parse.
- scoped helpers `query_feed_entries(feed_id, params, limit)` and `query_category_entries(category_id, params, limit)` (architecture §3.1 scoped endpoints) — or a single method that routes on presence of feed/category id; decide and keep it one code path.
- `async count_entries(params: dict) -> int` — a `limit=1`-style call returning only `total` (cheap pre-flight, D-Rule1). Distinct method so callers/traces show intent.

**Tests first (red):**
- single-page result → entries + total.
- multi-page: mock returns page1(100)+page2(100)+page3(50) with `total=250`; `limit=500` → 250 entries, 3 requests; `limit=150` → 150 entries, 2 requests (walk stops at limit).
- `count_entries` issues the cheap call and returns `total` without materializing entries.
- `include_content=False` → entries have `content is None`; `True` → content present.
- scoped feed/category query hits the scoped path.
- repeatable `status` params encoded as the pinned form.

**DoD:** ≥95%; pagination walk (the D7 payoff) has explicit multi-page + limit-stop tests.

---

## Chunk 2.4 — Entry hydration & mutation

**Purpose:** back the `get_entries`/`update_entries` services (architecture §3.3) and make starring declarative (D8).

**Public surface:**
- `async get_entries_by_id(ids: list[int], *, include_content=True) -> tuple[list[Entry], missing:list[int]]` — fetch each/bulk; ids Miniflux 404s on land in `missing` (partial success — events race deletions, §3.3). Decide bulk vs per-id against R1 (Miniflux may lack a bulk-by-id filter; if per-id, respect concurrency cap).
- `async set_entries_status(ids: list[int], status: str) -> int` — `PUT /v1/entries` bulk; returns count.
- `async set_entries_starred(ids: list[int], starred: bool) -> int` — **declarative** (D8): read current starred state of the ids, toggle (`PUT /v1/entries/{id}/bookmark`) only those that differ. Idempotent, retry-safe. Respects concurrency cap.

**Tests first (red):**
- hydrate mix of existing + deleted ids → existing returned, deleted in `missing`, no raise.
- `set_entries_status(['read'])` → issues the bulk PUT with the id list.
- declarative star: given 3 ids where 1 already starred, `set_entries_starred(ids, True)` → toggles only the 2 unstarred (assert exactly 2 bookmark calls); calling again → 0 toggles (idempotent).
- declarative unstar mirror-image.
- content default `True` on hydration (matches service default, §3.3).

**DoD:** ≥95%; the declarative-star read-then-diff (D8) is the headline test — no double-toggle possible.

---

## Chunk 2.5 — Admin: feeds, categories, refresh, discover, OPML

**Purpose:** feed/category lifecycle behind the admin services (architecture §3.3 admin family). Thin passthroughs; the "optional tier" methods are specified now, implemented after core if time-boxed.

**Public surface:**
- Feeds: `create_feed(feed_url, category_id=None, crawler=None, **opts) -> int`, `update_feed(feed_id, **fields)`, `delete_feed(feed_id)`, `refresh_feed(feed_id)`, `refresh_all_feeds()`.
- Categories: `get_categories()`, `create_category(title) -> int`, `update_category(id, title)`, `delete_category(id)`.
- `discover(url) -> list[candidate]` (optional tier).
- OPML: `export_opml() -> str`, `import_opml(opml: str)` (optional tier).

**Tests first (red):**
- each verb issues the right method+path+body (from fixtures/mocks).
- `create_feed` returns the new feed id; `delete_feed` issues DELETE; `refresh_feed` vs `refresh_all_feeds` hit single vs all endpoints (blast-radius separation mirrored from services, D-Rule2).
- `export_opml` returns the raw OPML string (large-payload path); `import_opml` posts it.
- errors propagate typed (400 on bad feed_url → `BadRequest` with Miniflux's message).

**DoD:** ≥95% for core verbs; optional-tier methods either implemented+tested or explicitly stubbed-and-skipped with a tracked note (they don't block Phases 3–6).

---

## Phase 2 exit criteria

- `api.py` is the only module importing `aiohttp`; grep-test guards this.
- ≥95% coverage; no test opens a real socket.
- A fixtures→api→rollup mini integration test proves the read path composes into a valid `Snapshot` (de-risks Phase 3).
- R1 contract-pinning completed and fixtures re-tagged; any wire deltas absorbed here.
- Declarative star (D8) and internal pagination (D7) each have dedicated passing tests — these are the two behaviors most likely to be wrong if reimplemented naively later.
