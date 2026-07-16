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

**Purpose:** the query surface behind `search_entries`/`count_entries` (architecture §3.3, D7).

**Public surface:**
- `async query_entries(params: dict, *, limit: int) -> tuple[total:int, entries:list[Entry]]` — issues `GET /v1/entries` with the param dict from `filters.to_query_params`, **walks limit/offset pages internally** (own page size, default 100, independent of whatever `limit`-shaped value is in `params`) until `limit` reached or Miniflux exhausted, returns Miniflux's `total` and the accumulated entries.
- `async count_entries(params: dict) -> int` — a `limit=1`-style call returning only `total` (cheap pre-flight, D-Rule1). Distinct method so callers/traces show intent.

**Resolved during implementation (RESOLVED, was open in this doc):** no separate scoped-endpoint methods (`query_feed_entries`/`query_category_entries`). `filters.to_query_params` already encodes `feed_id`/`category_id` as query params against the global `/v1/entries` endpoint — a scoped-path variant would be a second code path expressing the identical filter. One method, one path, per the "keep it one code path" note this doc originally left open.

**Tests first (red):**
- single-page result → entries + total.
- multi-page: mock returns page1(100)+page2(100)+page3(50) with `total=250`; `limit=500` → 250 entries, 3 requests; `limit=150` → 150 entries, 2 requests (walk stops at limit).
- `count_entries` issues the cheap call and returns `total` without materializing entries.
- repeatable `status` params encoded as the pinned form; boolean params lowercase `"true"`/`"false"`.

**DoD:** ≥95%; pagination walk (the D7 payoff) has explicit multi-page + limit-stop tests.

---

## Chunk 2.4 — Entry hydration & mutation

**Purpose:** back the `get_entries`/`update_entries` services (architecture §3.3) and make starring declarative (D8).

**Public surface:**
- `async get_entries_by_id(ids: list[int]) -> tuple[list[Entry], missing:list[int]]` — fetches each id individually via `GET /v1/entries/{id}` (see resolution below), concurrently, respecting the client's concurrency cap; ids Miniflux 404s on land in `missing` (partial success — events race deletions, §3.3).
- `async set_entries_status(ids: list[int], status: str) -> int` — `PUT /v1/entries` bulk; returns count.
- `async set_entries_starred(ids: list[int], starred: bool) -> int` — **declarative** (D8): read current starred state of the ids, toggle (`PUT /v1/entries/{id}/bookmark`) only those that differ. Idempotent, retry-safe. Respects concurrency cap.

**Resolved during implementation (RESOLVED, was open in this doc):**
- **Bulk vs per-id, and `include_content`:** per-id `GET /v1/entries/{id}` calls, not a speculative bulk-by-ids filter — nothing in the confirmed contract suggests Miniflux supports filtering `/v1/entries` by an explicit id list, and guessing a param name that doesn't exist would silently return wrong results rather than failing loudly. Relatedly, **no `include_content` parameter exists anywhere in `api.py`**: Miniflux's entry JSON always carries full content (there is no wire-level flag to suppress it), so there is nothing for the client to toggle. "Content only present in responses that asked for it" (D2) is enforced at the **Phase 5 service layer** by stripping the field from the response envelope when the caller didn't request it — api.py always fetches what Miniflux always sends.
- **`fetch_original` (readability re-fetch) is scoped out of this chunk**, moved to the optional tier alongside discover/OPML — it is a genuine extra HTTP call per entry (`GET /v1/entries/{id}/fetch-content`), not required for core hydration to work.
- `_request` gained `data`/`parse_json=False` parameters (chunk 2.5 needed them for OPML's raw-XML endpoints; documented here since it's a chunk-2.1-shaped change made when the need became concrete rather than speculatively upfront).

**Tests first (red):**
- hydrate mix of existing + deleted ids → existing returned, deleted in `missing`, no raise.
- `set_entries_status(['read'])` → issues the bulk PUT with the id list.
- declarative star: given 3 ids where 1 already starred, `set_entries_starred(ids, True)` → toggles only the 2 unstarred (assert exactly 2 bookmark calls); calling again → 0 toggles (idempotent).
- declarative unstar mirror-image.
- hydrated entries carry content (always -- see resolution above).

**DoD:** ≥95%; the declarative-star read-then-diff (D8) is the headline test — no double-toggle possible.

---

## Chunk 2.5 — Admin: feeds, categories, refresh, discover, OPML

**Purpose:** feed/category lifecycle behind the admin services (architecture §3.3 admin family). Thin passthroughs.

**Public surface:**
- Feeds: `create_feed(feed_url, category_id=None, crawler=None, **opts) -> int`, `update_feed(feed_id, **fields)`, `delete_feed(feed_id)`, `refresh_feed(feed_id)`, `refresh_all_feeds()`.
- Categories: `get_categories()`, `create_category(title) -> int`, `update_category(id, title)`, `delete_category(id)`.
- `discover(url) -> list[candidate]`.
- OPML: `export_opml() -> str`, `import_opml(opml: str)`.

**Resolved during implementation:** discover and OPML were fully implemented and tested here, not deferred — the "optional tier" framing in this doc's original draft turned out to be low cost to just build (a handful of thin passthroughs, no new design questions). OPML required extending `_request` with `data`/`parse_json=False` (raw XML in/out, not JSON) — documented in chunk 2.4's resolution notes since that's where the need first became concrete. **`fetch_original` (readability re-fetch via `GET /v1/entries/{id}/fetch-content`) is the one method genuinely NOT implemented in Phase 2** — carried forward as a tracked gap (see Phase 2 exit criteria) rather than built speculatively; add it in Phase 5 if a service actually needs it.

**Tests first (red):**
- each verb issues the right method+path+body (from fixtures/mocks).
- `create_feed` returns the new feed id; `delete_feed` issues DELETE; `refresh_feed` vs `refresh_all_feeds` hit single vs all endpoints (blast-radius separation mirrored from services, D-Rule2).
- `export_opml` returns the raw OPML string; `import_opml` posts it as raw XML body (not JSON).
- errors propagate typed (400 on bad feed_url → `BadRequest` with Miniflux's message).

**DoD:** ≥95% coverage; all listed verbs implemented and tested (met — see Phase 2 exit criteria for the one tracked exception).

---

## Phase 2 exit criteria

- `api.py` is the only module importing `aiohttp`; guarded by a permanent test (`tests/test_seams.py`), not just a one-off grep — verified to actually fail by injecting a fake violation and reverting.
- ≥95% coverage per module (achieved: 99%, the remaining fraction is a structurally-unreachable loop-exit branch, not an untested behavior); no test opens a real socket.
- R1 contract-pinning still outstanding (deferred to morning per the human's call) — every wire guess is isolated to `const.py` ASSUMED-tagged constants + this module + `normalize.py`, so the blast radius of any correction is contained as designed.
- Declarative star (D8) and internal pagination (D7) each have dedicated passing tests — these are the two behaviors most likely to be wrong if reimplemented naively later.
- **Tracked gap carried forward:** `fetch_original`/readability re-fetch is unimplemented (see chunk 2.5). Not required for Phase 3–6; add when a Phase 5 service needs it.
- **Dropped from scope (resolved, not deferred):** the fixtures→api→rollup mini integration test this doc originally called for is superseded by the R1 contract-pinning pass itself — once real fixtures land, the existing per-chunk unit tests already exercise every module in that chain against real shapes; a separate composed integration test would duplicate that coverage without adding a new failure mode it could catch.
