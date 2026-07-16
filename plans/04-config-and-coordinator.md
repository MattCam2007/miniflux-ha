# Phase 3 — Config Entry Lifecycle & Coordinator

**Goal:** make the integration configurable through the UI and give it a heartbeat. After this phase, adding the integration with a URL + API key produces a live `DataUpdateCoordinator` holding a `Snapshot`, firing feed transition events, and recovering visibly from failures. This is the backbone Phases 4–6 attach to.

**Depends on:** Phase 2 (`api.py`), Phase 1 (rollup, transitions, errors, models), Phase 0 (const, harness).
**Produces:** `config_flow.py`, `coordinator.py`, and the real `__init__.py` (setup/unload/reload + service & webhook registration hooks).
**Tested with:** `pytest-homeassistant-custom-component` (`hass`, config-entry flow helpers, `aioclient_mock`).
**Architecture refs:** §2.3 (poll path), §3.6 (device), D4 (hybrid poll authoritative), D9 (two-phase webhook handshake), D10 (fail-fast surfacing), R7 (HA floor), R10 (unique id).

Order: 3.1 config → 3.2 reauth → 3.3 options → 3.4 `__init__` setup/unload → 3.5 coordinator. (Coordinator last because `__init__` wires it, but its *logic* leans on Phase-1 rollup/transitions already tested — so 3.5's own tests are mostly pure-ish over a fake client.)

---

## Chunk 3.1 — Config flow (user step)

**Purpose:** UI setup of one instance (architecture Config; setup.md Part 1).

**Public surface:**
- `ConfigFlow` `async_step_user`: form fields `url`, `api_key`, `verify_ssl` (default True).
- On submit: build a client against a throwaway/HA session, call `get_me()` to validate; derive `unique_id` = `host + base_path + user_id` (R10); `async_set_unique_id` + `_abort_if_unique_id_configured`.
- Error mapping to form: `MinifluxAuthError` → `{"base": "invalid_auth"}`; `MinifluxConnectionError` → `{"base": "cannot_connect"}`; unexpected → `{"base": "unknown"}`.
- On success: create entry with `data = {url, api_key, verify_ssl, webhook_id}` where `webhook_id = webhook.async_generate_id()` is minted **now** (stable for the life of the entry, needed by D9's options step and Phase 6).

**Tests first (red):**
- happy path: valid creds → entry created, unique_id set, `webhook_id` present in data.
- bad key (mock 401) → form re-shown with `invalid_auth`, no entry.
- unreachable (mock connection error) → `cannot_connect`.
- duplicate instance (same unique_id already configured) → `abort` `already_configured`.
- url normalization: trailing slash / sub-path accepted and stored consistently (R9).

**DoD:** flow tests green; `webhook_id` minted at creation (unblocks D9).

---

## Chunk 3.2 — Reauth flow

**Purpose:** recover from a revoked/expired key without deleting the entry (architecture D10 auth row; setup.md troubleshooting).

**Public surface:**
- `async_step_reauth` / `async_step_reauth_confirm`: prompt for a new `api_key`, validate via `get_me()`, update the entry data, reload.
- Triggered by `ConfigEntryAuthFailed` raised in setup/coordinator (wired in 3.4/3.5).

**Tests first (red):**
- coordinator/setup raising `AuthError` → reauth flow started (assert flow in progress).
- submitting a valid new key → entry data updated, entry reloaded, flow ends.
- submitting another bad key → form re-shown with `invalid_auth`.

**DoD:** reauth round-trip tested; no entry removal on auth failure.

---

## Chunk 3.3 — Options flow (poll interval + webhook handshake)

**Purpose:** the D9 two-phase webhook wiring and tuning knobs, deliberately **not** in the initial config flow (the secret doesn't exist until Miniflux is pointed at the URL — architecture D9, setup.md Part 2).

**Public surface:**
- `OptionsFlow` with steps:
  - `init` / `settings`: `scan_interval` (default `DEFAULT_SCAN_INTERVAL`, floor `MIN_SCAN_INTERVAL`).
  - `webhook`: **displays** the full webhook URL (`webhook.async_generate_url(hass, webhook_id)`) via a description placeholder; input fields `webhook_secret`, `local_only` (default True).
- Persists into `entry.options`; on save, triggers a reload (so the coordinator picks up the new interval and Phase-6 receiver picks up the secret).

**Tests first (red):**
- options form renders the generated webhook URL in its placeholders (assert the URL string is present).
- saving a secret persists it to `entry.options`; round-trips on re-open.
- `scan_interval` below `MIN_SCAN_INTERVAL` → coerced/rejected to the floor.
- `local_only` default True persisted.

**DoD:** secret + interval persist; URL shown; reload triggered on change.

---

## Chunk 3.4 — `__init__.py` setup / unload / reload

**Purpose:** wire the entry's runtime: client → coordinator → platforms → services → webhook, and tear it all down cleanly (architecture §1 component map; D10).

**Public surface:**
- `async_setup_entry`:
  - build `MinifluxClient` with HA's shared session (`async_get_clientsession`, honoring `verify_ssl`).
  - construct coordinator; `await coordinator.async_config_entry_first_refresh()`.
    - first-refresh connection failure → `ConfigEntryNotReady` (HA retries setup) (D10).
    - auth failure → `ConfigEntryAuthFailed` (starts reauth, 3.2).
  - stash `client` + `coordinator` on `entry.runtime_data` (typed).
  - `async_forward_entry_setups([SENSOR, BINARY_SENSOR])` (Phase 4).
  - register services **once** (guard on `hass.services.has_service`) (Phase 5).
  - register the webhook receiver if a secret is configured (Phase 6); if not, no receiver + a repair issue is the Phase-6 concern.
  - add an options-update listener → reload.
- `async_unload_entry`: unload platforms, deregister the webhook, and unregister services **only when the last entry unloads** (multi-instance safe); pop `runtime_data`.

**Resolved during implementation:** this chunk as originally written has a forward dependency the plan didn't flag — `async_setup_entry` can't forward to `SENSOR`/`BINARY_SENSOR` platforms, register services, or register the webhook receiver until those modules (Phases 4/5/6) actually exist. Built incrementally instead: Phase 3's `__init__.py` covers only client + coordinator lifecycle (setup/unload/reload, no platform/service/webhook references); Phase 4 adds `PLATFORMS = [Platform.SENSOR, Platform.BINARY_SENSOR]` + `async_forward_entry_setups`/`async_unload_platforms` once `sensor.py`/`binary_sensor.py` exist; Phases 5/6 will add their own registration calls the same way when their modules land. Each addition ships with its own tests in `tests/test_init.py` rather than all being asserted in one chunk-3.4 pass.

**Tests first (red), as actually split across phases:**
- *(Phase 3)* setup with a healthy fake client → entry state `LOADED`, coordinator present.
- *(Phase 3)* first-refresh connection error → `ConfigEntryNotReady` (entry `SETUP_RETRY`).
- *(Phase 3)* first-refresh 401 → `ConfigEntryAuthFailed` (reauth started).
- *(Phase 3)* unload → `runtime_data` cleared; options update → reload invoked.
- *(Phase 4)* setup forwards exactly the two platforms; unload marks their entities `unavailable` (HA keeps a restored placeholder state rather than deleting the state record outright — the test asserts no entity is left reporting stale live data, not that the state machine forgets the entity existed).
- *(Phase 6, not yet built)* webhook deregistered on unload.
- *(deferred, low priority)* multi-instance service registration/unregistration guard — services are process-global (registered once regardless of entry count), so this is a Phase 5 concern to verify once services exist, not a per-entry lifecycle concern this chunk needs to test.

**DoD:** setup/unload symmetric and leak-free (no lingering webhook/service after last unload); failure modes map to the right HA exceptions (D10).

---

## Chunk 3.5 — Coordinator

**Purpose:** the poll heartbeat and transition emitter (architecture §2.3, D4).

**Public surface:**
- `MinifluxCoordinator(DataUpdateCoordinator[Snapshot])` with `update_interval` from options.
- `_async_update_data`:
  - concurrently fetch `get_feeds()`, `get_feed_counters()`, starred `count_entries(starred=True)` via the client.
  - `rollup.build_snapshot(...)` with `dt_util.utcnow()` injected (keeps `timeutil` pure).
  - `transitions.diff(self._prev_snapshot, snapshot)` → fire each event on `hass.bus` (`config_entry_id`+`instance_url` added per §3.5); store snapshot as `_prev`.
  - track `last_success_at` / `last_error` / `server_version` / `last_webhook_at` for the reachability sensor (§3.6).
  - on `MinifluxAuthError` → raise `ConfigEntryAuthFailed`; on other `MinifluxError`/timeout → raise `UpdateFailed` (entities go unavailable, D10).
- `async_request_refresh` fronted by a **debouncer** (`REFRESH_DEBOUNCE_SECONDS`) so webhook receipts (Phase 6) and mutations (Phase 5) coalesce (architecture §2.3 step 5, D4). Expose `note_webhook()` to bump `last_webhook_at` + request debounced refresh.

**Tests first (red):**
- successful cycle → `coordinator.data` is a valid `Snapshot`; matches rollup of the injected fake responses.
- first cycle fires **no** transition events (baseline, via `transitions.diff(None, …)`); a subsequent cycle with a newly-erroring feed fires `miniflux_feed_error` on the bus with the right payload (capture bus events).
- recovery cycle fires `miniflux_feed_recovered`.
- update raising `AuthError` → `ConfigEntryAuthFailed`; connection error → `UpdateFailed`.
- debounce: two rapid `async_request_refresh` calls within the window → one actual fetch (assert client call count).
- `note_webhook()` updates `last_webhook_at` and schedules a (debounced) refresh.

**DoD:** ≥90%; transition-on-bus and debounce-coalescing tested (the two behaviors that make D4's hybrid correct); auth vs connection failures raise the correct HA exceptions.

---

## Phase 3 exit criteria

- Add-integration → LOADED entry with a live coordinator and a device (device details finalized in Phase 4) — via flow tests.
- Poll failures surface as unavailable/reauth, never silent (D10) — tested.
- Webhook `webhook_id` minted at config time and its URL shown in options; secret persistable (D9) — tested. (Actual receipt handling is Phase 6.)
- Debounced refresh + transition-event emission proven, so Phases 5/6 can just call `async_request_refresh`/`note_webhook`.
