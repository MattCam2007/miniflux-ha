# F — Foundation — Units F-U1 … F-U14

> **🟢 PHASE 1 — BUILD NOW, but LAZILY.** Build only the foundation units C3/C4 actually consume, in the order given by [`00-START-HERE.md §2`](./00-START-HERE.md). **Baked decisions:** **D‑5** frontend lives in an isolated `frontend/` subtree; **D‑9** `F‑U1` is a prove-it-in-real-HA spike done first; **D‑3** single instance — keep the `config_entry_id` cache seam but **skip all multi-instance UX and the `S7` test matrix** (`F-U3` always auto-resolves the sole entry; `F-U13` editor always hides the entry picker); **D‑8** coverage floors (100% runtime, 90% views). The single HA user is typically **non-admin**, so in `F-U7` the entity-tick refresh path is the primary signal to build and test — the admin custom-event path is a bonus, not the baseline (`G4`).

**High-level source:** [`../01-foundation.md`](../01-foundation.md). Everything C1–C9 and the RC pipeline depend on. No user-visible card; the one integration-code change here is static-path + Lovelace-resource registration.

Baselines from [`00-method-and-conventions.md`](./00-method-and-conventions.md) apply throughout.

---

## Delivery & build

### `F-U1` — Bundle scaffolding, build, delivery (`DC1`)
**Depends on:** —
**Deliverable:** `frontend/src/` (TS + Lit), an esbuild/rollup config emitting `custom_components/miniflux/frontend/miniflux-cards.js`, and integration-side registration in `__init__.py`.
**Behavior:**
- Static path `/miniflux/frontend/...` registered at setup; Lovelace resource auto-added (storage mode) with `?v=<integration version>` cache-bust; idempotent across restarts/upgrades.
- YAML-mode: documented manual resource line (`docs/setup.md`).
- No runtime CDN fetches; CSP-clean (self-contained bundle).
**Tests:**
- pytest: setup registers the static path once; resource added once; re-setup doesn't duplicate; version bump changes the `?v=`.
- build: `miniflux-cards.js` emitted; a smoke import defines expected custom elements.
- CI check: committed bundle byte-matches a fresh build (no stale-bundle release).
**DoD:** fresh install shows cards in the picker with zero manual resource setup (storage mode).

### `F-U2` — Frontend test harness + `FakeHass`
**Depends on:** F-U1
**Deliverable:** Vitest config, `happy-dom` env, `FakeHass`, `fixture()` mount helper, coverage gate wiring.
**Behavior:** per [`00-method-and-conventions.md §2`](./00-method-and-conventions.md). Scriptable `callService`/`callWS`/`subscribeEvents`/`subscribeEntities`/`is_admin`; fake timers.
**Tests:** the harness self-tests — a trivial element mounts, reads `hass.states`, and a scripted `callService` resolves; fake timer advances a debounce.
**DoD:** `npm test` runs the three rings; coverage report emitted.

---

## Service access

### `F-U3` — `MinifluxApi`: config-entry resolution (`DC6`)
**Depends on:** F-U2
**Deliverable:** `frontend/src/api/entries.ts` — resolve Miniflux config entries from the entity/device registry.
**Behavior:** exactly one entry → auto-select; multiple → expose list for editors; zero → typed "not configured" error.
**Tests:** one entry auto-resolves; two entries → resolution requires explicit id (error names the ambiguity); zero → typed error; caches the registry lookup.

### `F-U4` — `MinifluxApi`: typed service wrappers (all 17 + `G*` additions)
**Depends on:** F-U3
**Deliverable:** one typed method per service over WS `call_service` + `return_response`, plus time/format helpers.
**Behavior:** each returns typed results; input shaping (durations, datetimes, status lists) in one place; **all** card service calls go through here.
**Tests (contract ring):** each wrapper builds the correct `call_service` payload; `return_response` parsed to typed objects; `published_within` duration and `published_after/before` datetime encodings correct; status-list encoding correct.

### `F-U5` — `MinifluxApi`: chunking + error normalization + request generations (`S8`)
**Depends on:** F-U4
**Deliverable:** transparent chunking, `{message, retriable}` error shape, stale-response dropping.
**Behavior:** `get_entries` split at `HYDRATE_IDS_MAX` (100), `update_entries` at `UPDATE_IDS_MAX` (500), responses merged; HA error → normalized shape rendered verbatim (`DC7`); a generation counter drops older in-flight responses.
**Tests:** 250 ids → 3 get_entries calls merged (incl. `missing` union); 1200 ids → 3 update calls; HA error → `{message, retriable}`, message preserved verbatim; older response after newer → dropped, newer rendered.

---

## Cache & refresh

### `F-U6` — `MinifluxStore`: cache + keys + isolation (`DC3`, `S7`)
**Depends on:** F-U5
**Deliverable:** query cache keyed by `(config_entry_id, service, canonical params)`; feeds/categories/icons long TTL, entry queries short TTL.
**Behavior:** canonical param serialization (order-independent); per-entry isolation (two instances never share); TTL expiry.
**Tests:** same params different key order → one cache entry; different entry ids → isolated caches; TTL expiry re-fetches; long-TTL feeds survive short-TTL entry invalidations.

### `F-U7` — `MinifluxStore`: refresh bus (`DC4`, `G4`, `S2`, `S9`)
**Depends on:** F-U6
**Deliverable:** invalidation from (a) `subscribeEvents` on 4 `miniflux_*` types (admin, debounced ≥2s), (b) `subscribeEntities` on the 4 entities (universal poll-tick), (c) local mutation bus.
**Behavior:** admin event burst → one debounced invalidation (`S2`); non-admin converges on entity ticks alone (`S9`, `G4`); local mutation invalidates affected keys immediately (`S4`).
**Tests:** 20 events in 1s → one invalidation after debounce; `is_admin:false` → no event subscription, entity tick still invalidates; a mutation on entry X invalidates its list keys but not unrelated feed keys.

### `F-U8` — `MinifluxStore`: optimistic layer + rollback (`DC5`, `S4`)
**Depends on:** F-U7
**Deliverable:** synchronous cache patch for entry mutations; revert + toast on failure; feed/category CRUD non-optimistic (pending + re-query).
**Behavior:** `update_entries` patches cached rows before the call; failure reverts exact prior `{status, starred}` and emits the backend message; CRUD shows pending, re-queries on success.
**Tests:** star patch visible before resolve; failure reverts to prior state + toast; two mounted views both reflect the patch (`S4`); CRUD not patched optimistically.

---

## UI atoms & registration

### `F-U9` — `<mf-confirm>` two-step destructive confirm (`DC5`, `S5`)
**Depends on:** F-U2
**Deliverable:** confirm dialog with a blast-radius line and optional hold-to-confirm.
**Behavior:** ≥2 deliberate interactions; shows a real count passed in; cancel is a no-op; `require_hold` → press-and-hold.
**Tests:** action fires only after confirm; cancel → no call; blast-radius text rendered from prop; hold variant needs sustained press.

### `F-U10` — `<mf-feed-picker>` / `<mf-category-picker>`
**Depends on:** F-U6; category picker needs `G1`
**Deliverable:** pickers backed by cached `get_feeds` / `get_categories`, with inline-create hook (category).
**Behavior:** emits ref by id or title (config, `S6`); inline "new category…" surfaces `create_category`; cache shared, invalidated on CRUD.
**Tests:** options from cache (no refetch per open); emits id vs title per config; inline-create calls `create_category` then re-queries; empty category (from `G1`) is selectable.

### `F-U11` — `<mf-offline>`, `<mf-truncation-notice>`, toast host
**Depends on:** F-U2
**Deliverable:** offline banner bound to reachability, "showing first N — refine" notice, toast/undo host.
**Behavior:** offline banner reflects `binary_sensor.*_reachable`; truncation notice from a capped-vs-total prop; toast supports an undo action + timeout.
**Tests:** reachable off → banner shown, on → hidden; truncation notice appears only when capped<total; toast undo callback fires within window, auto-dismiss after.

### `F-U12` — Virtualized list
**Depends on:** F-U2
**Deliverable:** windowed renderer for 500+ rows (`S1`), row-height aware for `<mf-entry-row>`.
**Behavior:** renders only visible + buffer rows; stable scroll; no layout thrash on data append (pagination).
**Tests:** 5000 rows → bounded DOM node count; scroll reveals/reclaims rows; append at tail preserves scroll position.

### `F-U13` — Card registration + editor base
**Depends on:** F-U3
**Deliverable:** shared `customCards` registration helper; editor base handling the `config_entry_id` picker (hidden when single instance) + common toggles.
**Behavior:** each card gets `getConfigElement`/`getStubConfig`/`getCardSize`/`getGridOptions`; editor base means per-card editors declare only their own options.
**Tests:** registering a card pushes correct picker metadata; editor hides entry picker with one instance, shows it with two; stub config valid.

### `F-U14` — Bundle integration smoke + no-leak check
**Depends on:** all F + at least C1
**Deliverable:** a test asserting the built bundle exposes only the intended custom elements and `window.customCards` entries, leaks no other globals, and issues no network at import.
**Tests:** import bundle → defined elements match the manifest list; `window` diff shows only expected additions; no `fetch`/XHR at import.
**DoD:** the `F-U1` CSP/offline and picker-visibility acceptance criteria hold end-to-end.

---

## Foundation acceptance (roll-up)
- Fresh install → all cards in picker, zero manual resource setup (storage mode).
- A `search_entries` round-trip returns typed entries; killing Miniflux mid-flight → normalized error, not an unhandled rejection.
- Two mounted cards: one mutation updates both within a frame (`S4`); non-admin converges after the next poll (`S9`).
- Bundle loads with no external requests and no stray globals.
