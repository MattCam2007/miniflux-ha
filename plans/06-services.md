# Phase 5 — Services (query / mutation / admin)

**Goal:** the programmable surface Unity scripts call. Services validate input (schema + pure `filters`) **before any HTTP**, dispatch to `api.py`, and shape responses via pure mappers. They fail loudly — validation errors before the call, mapped Miniflux errors after — never a silent empty return (architecture §3.3). Split by responsibility per the §4 rationale, not per endpoint.

**Depends on:** Phase 2 (`api.py`), Phase 3 (coordinator for snapshot-based title resolution + `async_request_refresh`), Phase 1 (filters, models, errors), Phase 0 (const, service-name constants).
**Produces:** `services.py`, `services.yaml`.
**Tested with:** register services against a `hass` with a fake client on a config entry; assert validation-before-HTTP, dispatch, and response envelopes. Transport errors come from the fake raising Phase-1 error types.
**Architecture refs:** §3.3 (service table + conventions), §4 (boundary rationale: Rule 1/2/3), D7 (pagination inside search), D8 (declarative mutation), D10 (loud failure), R3 (no tag-write).

**Cross-cutting conventions (implement once, in a shared helper, test once):**
- **Targeting:** optional `config_entry_id`; single configured entry → auto-resolved; multiple → required; missing/ambiguous → `ServiceValidationError` (architecture §3.3 targeting rule).
- **Error surfacing:** caller mistakes → `ServiceValidationError` (raised pre-HTTP); Miniflux/transport failures → `HomeAssistantError` with `errors.user_message(...)`. Both fail the calling script step visibly (D10).
- **Response support:** query services use `SupportsResponse.ONLY`; mutations `SupportsResponse.OPTIONAL`; `services.yaml` documents fields for the UI.
- **Ref sugar:** `category`/`feed` accept id or exact title; titles resolved via the coordinator snapshot (`filters.resolve_refs`) with no extra API call; unknown/ambiguous → validation error.

Order: 5.0 shared plumbing → 5.1 query → 5.2 mutation → 5.3 admin. Each service is its own red-green chunk; grouped here by family.

---

## Chunk 5.0 — Service plumbing (registration, targeting, error wrapping)

**Public surface:**
- `async_register_services(hass)` — idempotent (guard via `hass.services.has_service`); called from `__init__` setup (3.4).
- `_resolve_entry(hass, call) -> (entry, client, coordinator)` — the targeting helper.
- `_run(coro)` wrapper mapping Phase-1 errors → `HomeAssistantError`/`ServiceValidationError`.

**Tests first (red):**
- single entry, no `config_entry_id` → resolves it.
- two entries, no id → `ServiceValidationError`; with a valid id → resolves; with an unknown id → validation error.
- a service body raising `MinifluxConnectionError` → surfaces as `HomeAssistantError` carrying `user_message` (not a bare traceback).

**DoD:** targeting + error wrapping proven once; every service reuses them.

---

## Chunk 5.1 — Query family

Rule 1 (architecture §4): shared filter schema, output differs → separate names, stable shapes, one validation module (`filters`).

**Services & envelopes (architecture §3.3):**
- `miniflux.search_entries` → build `EntryFilter` from call data; `validate()`; `resolve_refs(snapshot)`; `to_query_params`; `api.query_entries(..., limit)`; return `{total, count, entries:[Entry-as-dict]}`. `include_content` default **False**; `fetch_original` default False. `SupportsResponse.ONLY`.
- `miniflux.count_entries` → same filter build, `api.count_entries` → `{total}`. Cheap pre-flight (D-Rule1).
- `miniflux.get_entries` → `entry_ids` (1–`HYDRATE_IDS_MAX`); `api.get_entries_by_id(include_content default True)` → `{entries, missing}` (partial success, §3.3).
- `miniflux.get_feeds` → `category?`, `only_with_errors?`; **live** `api.get_feeds()` (not cache — remediation/inventory surface, replaces per-feed entities) filtered → `{feeds}`.

**Tests first (red):**
- `search_entries` maps filter fields to the query dict (spy on the fake client's received params) and returns `{total,count,entries}`; `count == len(entries)`, `total` from client.
- invalid filter combo (`within`+`after`) → `ServiceValidationError` **before** any client call (assert client not called).
- unknown category title → validation error, no client call.
- `include_content` default False → requested content flag False to client; explicit True → content present in response.
- `count_entries` returns `{total}` and calls the cheap path (not `query_entries`).
- `get_entries` with a deleted id → that id in `missing`, others in `entries`; over `HYDRATE_IDS_MAX` → validation error.
- `get_feeds(only_with_errors=True)` → only error feeds returned, freshly fetched.

**DoD:** validation-before-HTTP proven per service; envelopes exact; defaults (content off for search, on for hydrate) enforced.

---

## Chunk 5.2 — Entry-mutation family

Rule 2 (architecture §4): declarative over a target set = one service; scope-level mutation = a separate service (different blast-radius class).

**Services:**
- `miniflux.update_entries` → `entry_ids` (1–`UPDATE_IDS_MAX`), optional `status`, optional `starred` (**at least one required**). Dispatches `api.set_entries_status` and/or the **declarative** `api.set_entries_starred` (D8). Returns `{updated}`. On success, calls `coordinator.async_request_refresh` (debounced) so sensors don't lie (architecture §2.1 step 8 / §2.2 step 6).
- `miniflux.mark_all_read` → exactly one of `feed` / `category` / `everything:true`. Separate service; its `services.yaml`/description carries the race warning steering pipelines to `update_entries` (architecture §2.2, §3.3).

**Tests first (red):**
- `update_entries` with neither `status` nor `starred` → `ServiceValidationError`.
- `status: read` → `set_entries_status` called with the ids; refresh requested afterward.
- `starred: true` → declarative star path invoked (D8; behavior already unit-tested in 2.4 — here assert the service calls it and requests refresh).
- both → both dispatched.
- over `UPDATE_IDS_MAX` ids → validation error.
- `mark_all_read` with two scope args → validation error; with exactly one → routes to the right scoped client call; `everything:true` → user-scope mark-all.

**DoD:** at-least-one and exactly-one guards proven; post-mutation refresh requested (keeps §2.x consistency); mark-all kept a typo away from nothing (separate service).

---

## Chunk 5.3 — Admin family

Rule 3 (architecture §4): per-verb services for honest static schemas; destructive verb isolated.

**Services (core):**
- `miniflux.create_feed` (`feed_url` required, `category?`, `crawler?`, curated opts) → `{feed_id}`.
- `miniflux.update_feed` (`feed` + optional mutable fields).
- `miniflux.delete_feed` (`feed`; single; destructive — its own name).
- `miniflux.refresh_feed` (`feed` required).
- `miniflux.refresh_all_feeds` (no args; separate from single — blast-radius separation, D-Rule2).

**Services (optional tier — spec now, implement after core):**
- `miniflux.discover_feeds` (`url`) → `{feeds}`.
- `miniflux.create_category` / `update_category` / `delete_category`.
- `miniflux.export_opml` → `{opml}` (enables the nightly-backup automation, setup.md Part 3); `miniflux.import_opml` (`opml`).

**Tests first (red):**
- `create_feed` without `feed_url` → validation error; with it → client `create_feed` called, `{feed_id}` returned.
- `delete_feed` dispatches DELETE; is a distinct service (not an `action` enum) — assert its schema requires only `feed`.
- `refresh_feed` requires `feed`; `refresh_all_feeds` takes none and hits the all-endpoint — the two can't be confused.
- title-ref sugar: `update_feed(feed="My Blog")` resolves the title to an id via snapshot; unknown → validation error.
- (optional tier, if implemented) `export_opml` returns the raw string; category CRUD verbs dispatch correctly.

**DoD:** each verb has an honest schema (per-verb, Rule 3); destructive `delete_feed` isolated; optional-tier either done+tested or skipped-with-note (doesn't block release).

---

## Chunk 5.4 — `services.yaml` + service strings

**Purpose:** the HA UI needs field definitions (`services.yaml`) and localized names/descriptions (`strings.json`/`translations`, finalized Phase 8) to render service forms; hassfest validates these.

**Produces:** `services.yaml` with every service's fields, selectors (entity/text/number/boolean/object), defaults, and — critically — the `mark_all_read` race warning and the `fetch_original` "slow, hits origin sites" note in descriptions (architecture §3.3).

**Tests first (red):**
- hassfest passes with the services defined (gate).
- a test asserting every registered service name has a `services.yaml` entry and vice-versa (no undocumented/orphan services).

**DoD:** hassfest green; service/`services.yaml` sets match exactly.

---

## Phase 5 exit criteria

- Every service: validation-before-HTTP (client-not-called-on-bad-input tests), correct dispatch to the fake client, exact response envelope, loud typed failures (D10).
- The §4 cut is realized: shared-schema queries share `filters`; declarative `update_entries` vs scope `mark_all_read`; per-verb admin with isolated `delete_feed`.
- Mutations request a debounced coordinator refresh (sensor consistency).
- **R3 recorded in release notes:** no tag-write service exists because stock Miniflux has no such API; engagement = starred (settable via `update_entries`) + `save_entry` event. Any "tag it" consumer requirement is out of scope until R3 is resolved.
