# Phase 1 — Pure Core (framework-free, 100% coverage)

**Goal:** implement every piece of non-trivial logic as a pure function/dataclass with **no `homeassistant` import and no I/O**, so it is testable with plain `pytest` and locked at 100% line+branch coverage. This is architecture §8.1 made concrete. Everything later (client, coordinator, services, webhook) composes these.

**Depends on:** Phase 0 (`const.py`, harness).
**Produces:** `models.py`, `timeutil.py`, `normalize.py`, `filters.py`, `signature.py`, `webhook_payload.py`, `rollup.py`, `transitions.py`, `errors.py`.
**Hard rule:** a test in this phase asserting behavior must pass without HA installed. If a module needs HA, it's in the wrong phase.
**Architecture refs:** §3.2 (normalized objects), §3.4/§3.5 (webhook/events), §8.1, D2/D7/D8, R1/R5.

Build chunks in order; 1.2 and 1.3 depend on 1.1; 1.6 depends on 1.1+1.5; 1.8 depends on 1.7; the rest depend only on 1.1/`const`.

---

## Chunk 1.1 — `models.py` + harness builders

**Purpose:** the normalized shapes every internal consumer speaks (architecture §3.2). Frozen dataclasses; no behavior beyond projection.

**Public surface:**
- `Entry(id, feed_id, feed_title, category_id, category_title, title, url, author, published_at, changed_at, status, starred, reading_time, tags, content=None)` — `content` optional (present only when requested, D2).
- `EntryCompact(id, feed_id, title, url, published_at, author)` + classmethod `from_entry(entry, *, title_cap=TITLE_TRUNCATE) -> EntryCompact`.
- `Feed(id, title, site_url, feed_url, category_id, category_title, checked_at, parsing_error_count, parsing_error_message, disabled)`.
- `Snapshot(fetched_at, feeds, unread_total, unread_by_feed, unread_by_category, starred_total, error_feeds)` with helper `error_feed_ids` property.

**Also produces (moved here from 0.3):** the model-dependent `conftest` builders — `snapshot_factory`, `fake_api` (typed to return these models), `signed_webhook_request`.

**Tests first (red):**
- constructing each model with required fields; frozen (mutation raises).
- `EntryCompact.from_entry` copies the 6 fields and truncates `title` to `TITLE_TRUNCATE` (exactly-at-cap not truncated; over-cap truncated; short unchanged).
- `Snapshot.error_feed_ids` returns ids of `error_feeds`.

**DoD:** 100% coverage; imported by 1.2+.

---

## Chunk 1.2 — `timeutil.py`

**Purpose:** all time math in one place (architecture §3.1 "Time normalization rule"). Nothing else does time conversion.

**Public surface:**
- `parse_ts(raw: str) -> datetime` → timezone-aware UTC. Accepts Miniflux RFC 3339 with offset; raises a `ValueError` subtype on garbage.
- `to_filter_param(dt: datetime) -> int` (or str) → the value Miniflux expects for `published_after`/`_before` (pin exact form in R1; keep the conversion here so a change is one edit).
- `window_to_bounds(now: datetime, duration: timedelta) -> tuple[bound_after]` → resolves `published_within` to an absolute lower bound (D7/§3.3 sugar).

**Tests first (red):**
- offset-bearing string → correct UTC instant; naive/garbage → raises.
- a known local-offset timestamp round-trips to the right UTC.
- `window_to_bounds(now, 36h)` → `now - 36h`, tz-aware, correct across a DST boundary (use a fixed `now`, no `datetime.now()` in code paths under test — inject `now`).
- `to_filter_param` of an aware dt is stable and matches the pinned format.

**DoD:** 100%; **no** call to real `now()` inside pure functions — time is always passed in (keeps tests deterministic; the coordinator injects `dt_util.utcnow()` later).

---

## Chunk 1.3 — `normalize.py`

**Purpose:** raw Miniflux JSON dict → `Entry`/`Feed`. The only place besides `api.py` that knows Miniflux field names (seam corollary).

**Public surface:**
- `entry_from_json(d: dict) -> Entry` — joins nested `feed`/`category` objects to flat fields; `content` set only if the key is present and non-empty (D2); `tags` defaults to `[]`; timestamps via `timeutil.parse_ts`.
- `feed_from_json(d: dict) -> Feed` — pulls `parsing_error_count`, `parsing_error_message`, `checked_at`, `disabled`, category.

**Tests first (red):** consume `tests/fixtures/` *parsed* cases:
- full entry → all fields populated; nested feed/category flattened.
- entry without `content` key → `content is None`; with empty `content` → `None`.
- entry missing optional author/tags → sane defaults.
- feed with `parsing_error_count > 0` → carries count+message; healthy feed → `0`/empty.
- feed with null category → `category_id/title None` (feeds can be uncategorized).

**DoD:** 100%; every fixture entry/feed shape has a test.

---

## Chunk 1.4 — `filters.py`

**Purpose:** the entry-filter model shared by `search_entries`/`count_entries` (architecture §3.3, service Rule 1) → Miniflux query params, with title→id resolution and validation. Pure; takes a `Snapshot` for title resolution rather than calling the API.

**Public surface:**
- `EntryFilter(category=None, feed=None, status=('unread',), starred=None, search=None, published_within=None, published_after=None, published_before=None, order=None, direction=None, limit=SEARCH_LIMIT_DEFAULT, ...)`.
- `EntryFilter.validate()` → raises `FilterError` (a pure error type, not HA) on: `published_within` combined with `published_after/_before`; `limit > SEARCH_LIMIT_MAX`; unknown `status` value; empty `entry_ids` where required (for the id-based services).
- `resolve_refs(filter, snapshot) -> ResolvedFilter` → turns `category`/`feed` given as **title strings** into ids using the snapshot; numeric ids pass through; unknown or ambiguous title → `FilterError` naming it.
- `to_query_params(resolved, now) -> dict` → the query dict for `api.py`; applies `timeutil` for time fields; encodes repeatable `status`.

**Tests first (red):**
- `within` + `after` together → `FilterError`.
- `limit` over cap → `FilterError` naming the cap.
- title `"News"` present once in snapshot → resolves to its id; absent → error; ambiguous (two categories same title) → error.
- numeric id passes through untouched.
- `status=('unread','read')` → two repeated params (or the pinned encoding).
- `published_within=36h` with injected `now` → correct absolute bound param; mutually-exclusive guard already enforced.

**DoD:** 100%; this module + `timeutil` are the whole query-building contract — client just passes the dict through.

---

## Chunk 1.5 — `signature.py`

**Purpose:** central HMAC verification (architecture D1, §3.4). The security crux — unsigned payloads must never pass.

**Public surface:**
- `verify(secret: str, raw_body: bytes, provided_signature: str) -> bool` — compute HMAC-SHA256 over `raw_body`, hex-encode, `hmac.compare_digest` against `provided_signature` (constant-time). Returns `False` (never raises) on empty/missing secret, empty signature, or malformed hex.
- `extract_event_type(headers: Mapping) -> str | None` — reads Miniflux's event-type header (exact name pinned R1; kept here so one edit fixes it).

**Tests first (red):**
- correct signature for a body → `True`.
- any body/secret/signature mismatch → `False`.
- empty secret → `False` (not exception) — this is the "no secret configured yet" path (§2.1).
- non-hex / truncated signature → `False`, no exception.
- `compare_digest` is used (guard against a naive `==` creeping in — assert via a test that would be timing-fragile only conceptually; practically assert the function rejects a same-length wrong sig and that implementation calls `hmac.compare_digest`).
- `extract_event_type` returns `new_entries`/`save_entry`/`None` from header variants.

**DoD:** 100% incl. every rejection branch; **the `signed_webhook_request` conftest helper (1.1) is asserted to produce signatures that `verify` accepts** — pins helper↔module agreement so Phase 6 tests can't pass on a broken helper.

---

## Chunk 1.6 — `webhook_payload.py`

**Purpose:** verified raw body → typed, compact, bounded event payload (architecture §3.5, D2). Runs *after* signature verification.

**Public surface:**
- `parse_and_project(raw_body: bytes, event_type: str) -> ProjectedEvent | PayloadError` where `ProjectedEvent` carries the HA event type name and the payload dict per §3.5.
  - `new_entries` → `{feed:{...}, entry_count: <true count>, entries: [EntryCompact...][:EVENT_ENTRIES_CAP], truncated: bool}`. `entry_count` is the true number even when the list is capped.
  - `save_entry` → `{entry: EntryCompact}`.
  - malformed individual entry → skipped, but `entry_count` still reflects the payload's stated/total count (don't let one bad entry drop the count).
  - unknown `event_type`, non-JSON body, or wrong top-level shape → `PayloadError` (→ HTTP 400 in Phase 6, never an exception escaping).

**Tests first (red):** from `tests/fixtures/` raw webhook bodies:
- 200-entry `new_entries` → `entries` length 50, `truncated True`, `entry_count == 200`.
- small `new_entries` → `truncated False`, count matches.
- `new_entries` with one malformed entry among good ones → bad one skipped, others projected, count intact.
- `save_entry` → single `EntryCompact`.
- content is **never** present in output (assert no `content` key anywhere).
- non-JSON bytes → `PayloadError`.
- unknown event type → `PayloadError`.

**DoD:** 100%; no `content` ever leaks (explicit test) — protects the recorder (D2).

---

## Chunk 1.7 — `rollup.py`

**Purpose:** feeds + counters → `Snapshot` (architecture §2.3 step 2, §3.2). Pure aggregation.

**Public surface:**
- `build_snapshot(feeds: list[Feed], counters: CountersRaw, starred_total: int, fetched_at: datetime) -> Snapshot`.
  - `unread_total` from counters; `unread_by_feed` map; `unread_by_category` = rollup joining counters→feed→category; `error_feeds` = feeds with `parsing_error_count > 0`.

**Tests first (red):**
- counters + feeds → correct global total and per-category rollup.
- feed without a category → contributes to totals but not to any category bucket (no crash).
- category with all-read feeds → appears with `unread: 0` only if it has feeds; a zero-feed category is absent (documented acceptable, architecture §3.2).
- counters referencing a feed id not in `feeds` (deleted mid-cycle) → ignored, no KeyError.
- `error_feeds` contains exactly the >0 feeds, sorted deterministically (e.g., by id) for stable attributes/tests.

**DoD:** 100%; deterministic ordering so Phase 4 attribute tests are stable.

---

## Chunk 1.8 — `transitions.py`

**Purpose:** diff two snapshots into feed error/recovered events (architecture §2.3 step 3, §3.5). Pure; the coordinator (Phase 3) only calls this and fires the results.

**Public surface:**
- `diff(prev: Snapshot | None, cur: Snapshot) -> list[TransitionEvent]` where each `TransitionEvent` is `(event_type, payload)` per §3.5 (`miniflux_feed_error` / `miniflux_feed_recovered`).
  - `prev is None` (first poll after startup) → **empty list** (baseline; no spam on restart).
  - feed newly in error set (0→>0) → one `feed_error`.
  - feed leaving error set → one `feed_recovered`.
  - a feed still in error with a changed count → no new event (already surfaced; avoid churn) — *decision to confirm:* re-emit on message change? Default: no; flag as R-note in phase footer.

**Tests first (red):**
- `prev=None` → `[]`.
- healthy→error for feed A → single error event with count+message.
- error→healthy for feed A → single recovered event.
- feed staying in error → no event.
- simultaneous: B enters while C recovers → both events, order deterministic.
- flapping across three snapshots (ok→err→ok) → error then recovered.

**DoD:** 100%; baseline-on-first-poll explicitly tested (regression guard for restart spam).

---

## Chunk 1.9 — `errors.py`

**Purpose:** the typed error hierarchy and HTTP→error mapping (architecture §3.1 error table). Pure; `api.py` raises these, everyone else catches them.

**Public surface:**
- Exception types: `MinifluxError` (base) → `MinifluxConnectionError`, `MinifluxAuthError`, `MinifluxBadRequestError` (carries Miniflux's `error_message`), `MinifluxNotFoundError`, `MinifluxServerError`.
- `map_http_error(status: int, body: dict | str | None) -> MinifluxError` — 401→Auth, 400/422→BadRequest(with message), 404→NotFound, 5xx→Server, other→base with status.
- `user_message(err) -> str` — the human string surfaced in service errors / logs (architecture §3.1 "Surfaced as" column), e.g. includes instance url + cause.

**Tests first (red):**
- each status maps to the right type.
- 400 body with `error_message` → message carried verbatim into the exception and into `user_message`.
- 404 → NotFound; unknown 418 → base with status in message.
- `user_message` for connection error mentions unreachable + (a placeholder for) url.

**DoD:** 100%; these types are the contract Phase 2 raises and Phases 3/5 translate to `ConfigEntryAuthFailed` / `HomeAssistantError` / `UpdateFailed`.

---

## Phase 1 exit criteria

- All 9 modules at 100% line+branch.
- **Framework-freedom is a source-level check, not a dynamic import check (resolved during Phase 3 implementation, was a dynamic subprocess check in earlier drafts of this plan):** once `__init__.py` legitimately imports `homeassistant` for entry setup (Phase 3, unavoidable — it's the integration's actual entry point), Python's import model means importing *any* submodule of `custom_components.miniflux` transitively runs `__init__.py` first, so "importable with HA absent" stops being a meaningful or achievable property of the package's submodules — that's true of every HA custom integration, not a coupling problem specific to these modules. The thing that's actually architecturally meaningful — that each pure-core module's *own source* never references an HA API — is what `tests/test_seams.py::test_pure_core_modules_have_no_homeassistant_import` checks (a source-text guard, verified to catch a real violation by injecting one and confirming failure), consistent with the existing aiohttp-import seam guard in the same file. There is no separate CI step or standalone script for this; it runs as part of the normal `pytest tests/` collection.
- Conftest builders (`snapshot_factory`, `fake_api`, `signed_webhook_request`) exist and agree with the real modules (1.5 pins the signer).
- Fixtures cover every edge case referenced above; each tagged with its Miniflux source version (R1).
- Deviations footer records the one open micro-decision (re-emit feed_error on message change — default no).
