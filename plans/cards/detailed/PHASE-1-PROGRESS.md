# Phase 1 progress — where we are, exactly

**Last updated:** 2026-07-17
**Scope:** the Phase 1 build described in [`00-START-HERE.md`](./00-START-HERE.md) — Foundation → `G2` → C3 feed manager → `G1` → C4 category manager. Nothing here touches Phase 2 (reader, search, triage, health, OPML, activity, rich-content).

This file tracks Phase 1 specifically. `STATUS.md` at the repo root remains the ground-truth snapshot for the backend; this file is the equivalent snapshot for the frontend + the two Phase 1 backend gaps.

---

## Done: all 19 steps of the build order

Every step in [`00-START-HERE.md` §2](./00-START-HERE.md#2-phase-1--the-exact-build-order) is complete and merged to this branch.

| Step | Unit | What shipped |
|---|---|---|
| 1 | `F-U1` | Bundle scaffolding + delivery: `frontend/` subtree (D-5), static path + auto Lovelace resource registration (`custom_components/miniflux/frontend.py`). **Validated in a real HA** before the rest of the build continued (D-9). |
| 2 | `F-U2` | Vitest harness: `FakeHass` (scriptable `callService`/`subscribeEvents`, entity registry, `is_admin`), `fixture()` Lit mount helper, per-file coverage-floor gate (`frontend/scripts/check-coverage-floors.mjs`), wired into CI. |
| 3 | `G2` | `get_feeds` joins each feed's unread count from the coordinator's polled snapshot ("as of last poll"); absent from the snapshot → `0`, never `null`, never a live counters fetch (D-6). |
| 4 | `G1` | New `get_categories` service: live `GET /v1/categories` (the only way an empty category is ever observable — the poll snapshot is feed-derived and structurally can't represent one), `feed_count`/`unread` joined from the snapshot where available, `null` when unknown (D-7). Also corrected a stale `strings.json` description that claimed category delete doesn't cascade — it does (D-4). |
| 5 | `F-U3` | `resolveConfigEntryId`: scans the entity registry for `platform: "miniflux"` entities; single instance auto-resolves (D-3), zero/multiple are typed errors, cached by `hass.entities` object identity. |
| 6 | `F-U4` | `MinifluxApi`: one typed method per Phase 1 service (`get_feeds`, `get_categories`, `count_entries`, `create_feed`, `update_feed`, `delete_feed`, `refresh_feed`, `refresh_all_feeds`, `discover_feeds`, `mark_all_read`, `create_category`, `update_category`, `delete_category`) over `hass.callService`'s WS `call_service` path. Every call threads `config_entry_id` explicitly (D-3's live seam). `returnResponse` gated per-service against HA's actual `SupportsResponse` registration (verified against HA core source — passing `true` for a `NONE`-response service raises `ServiceValidationError`). |
| 7 | `F-U5` | Error normalization (`MinifluxApiError` / `{message, retriable}`), with the retriable split verified against HA core's WS `call_service` error-code mapping (`service_validation_error`/`invalid_format`/`not_found` are caller mistakes, never retriable). `GenerationGuard` for dropping stale in-flight responses. Entry-query chunking skipped — Phase 1 has no `get_entries`/`update_entries` wrapper to chunk. |
| 8 | `F-U6` | `QueryCache`: order-independent keys always scoped by `config_entry_id` (S7's seam); long/short TTL tiers (Phase 1 only uses the long tier). |
| 9 | `F-U7` | `RefreshBus`: admin bus events on the 4 `miniflux_*` types, debounced ≥2s; entity-tick fallback (`onHassUpdate`, called from a card's own `hass` setter — **not** a websocket subscription, see the design-correction commit); local mutations invalidate immediately. A non-admin `subscribeEvents` call rejects (`Unauthorized`, matches HA core) rather than silently no-op'ing. |
| 10 | `F-U8` | `applyOptimisticPatch`: patches every cache key holding the affected row across all mounted views in one frame, reverts to the exact prior value on failure. Used by C3's feed rename and enable/disable, and C4's category rename — everything else stays non-optimistic (pending + re-query). |
| 11 | `F-U9` | `<mf-confirm>`: two-step confirm with a real blast-radius message; `require-hold` swaps the confirm button for a press-and-hold variant (releasing early cancels with no effect). |
| 12 | `F-U10` | `<mf-feed-picker>` / `<mf-category-picker>`: share a `MinifluxStore` cache across instances (no duplicate fetch), emit id or title per config, empty categories select like any other. Category picker's inline "+ New category…" surfaces `create_category` and re-queries. |
| 13 | `F-U11` | `<mf-offline>` (bound to `binary_sensor.miniflux_reachable`), `<mf-truncation-notice>`, `<mf-toast-host>` (imperative `.show()`, Undo cancels the auto-dismiss timer). |
| 14 | `F-U12` | `<mf-virtual-list>`: fixed-row-height windowing for 500+ rows; reads the card's own `height` config as viewport size rather than measuring real DOM layout; never writes `scrollTop` itself, so appends can't disturb scroll position. |
| 15 | `F-U13` | `registerCard()` (shared `window.customCards` push) and `MfCardEditorBase` (owns the `config_entry_id` picker, hidden except with a genuine multi-instance setup; HA's standard `config-changed` event contract). |
| 16 | `C3-U1..U5` | `<miniflux-feed-manager-card>` — full feed CRUD, add-feed wizard (discover or direct URL), edit sheet (dirty-fields-only), row actions (refresh/mark-read/enable-disable/delete), 500-feed virtualization. See below for the two real bugs found and fixed while testing this unit. |
| 17 | `C4-U1..U4` | `<miniflux-category-manager-card>` — full category CRUD including empty categories, cascade-aware delete (`require_hold` defaults **true**, unlike C3's feed delete), mark-read, expand-to-feeds. |
| 18 | `F-U14` | Bundle no-leak check: asserts the built bundle registers exactly the intended custom elements, adds nothing to `window` beyond `customCards` (and Lit's own version-tracking globals, which are expected), and issues no network request at import. The throwaway `<miniflux-spike-card>` from the `F-U1` spike is deleted. |
| 19 | Real-HA validation | **Not done yet — see "What's left" below.** This is the gate before any release. |

**Test counts at this commit:** 469 backend (Python) tests, 241 frontend (Vitest) tests — 710 total, all green. Every runtime file (`src/api/`, `src/store/`, `src/atoms/`, `src/lib/`) is at its **100%** line+branch coverage floor; every card/view file (`src/cards/`) is at its **90%** floor (most are at or near 100% anyway). Backend: `services.py`, `api.py`, `normalize.py`, `models.py` all at 100%, matching the pre-existing bar. Bundle: 57.0kb, self-contained (Lit bundled in, no CDN fetches), production build (Lit dev-mode warnings stripped).

### Two real bugs found and fixed while building C3 (worth knowing about)

Writing tests against the *intended* behavior — not the code as first written — caught two genuine bugs before they shipped:

1. **Optimistic rename didn't actually render optimistically.** The cache patch landed correctly, but the card's own `_feeds` state (what actually renders) was only refreshed *after* the mutation resolved — so the "instant" rename wasn't instant. Fixed by patching the card's local state in parallel with the cache.
2. **Stale-closure clobbering in the edit sheet.** Each field's `@change` handler closed over a destructured snapshot of `_editing` taken at render time. Two field edits landing before Lit's next render flushed would silently overwrite each other (edit title, then immediately toggle a checkbox → the title edit vanishes). Fixed with a small `_updateEditing()` helper that always merges into the *current* `_editing`, never a stale local.

### Descoped on purpose (not silently dropped)

- **C4's "by_category sensor-attribute first paint" optimization** (instant paint from the existing sensor attribute, reconciled once the real `G1` query lands) — a perceived-performance nicety with no functional gap if skipped; the card renders correctly either way, just from `G1` alone.
- **C4's "tap unread count → push a category filter to a co-located C2"** — C2 (the reader card) doesn't exist until Phase 2, so there is no consumer for this bus event yet.

---

## What's left

### 1. Real-HA validation (step 19) — the actual gate

Nothing below has been checked against a genuine running Home Assistant yet:

- [ ] Both cards appear in the "+ Add Card" picker with zero manual resource setup on a storage-mode dashboard.
- [ ] C3: add a feed via discovery, edit every mutable field, delete (confirm + real count), refresh, mark-read, enable/disable — all reachable, zero gaps.
- [ ] C4: create, rename, delete an **empty** category, delete a category **with** feeds (confirm the cascade actually happens and the hold-to-confirm gesture works on a touchscreen/mouse, not just synthetic test events), mark-read.
- [ ] Unread badges (C3) update on a real poll tick without a page reload.
- [ ] Pull Miniflux's network access and confirm both cards degrade honestly (offline banner, actions disabled) and recover without a reload.
- [ ] GitHub Actions CI green on this branch: hassfest/HACS validation, Python tests + coverage floors, JS build + bundle-freshness, JS tests + coverage floors. (All of this passes locally; it has not been observed running on GitHub's own runners yet.)

### 2. Everything Phase 2 (explicitly out of scope until Phase 1 ships and validates — D-1)

The reader (C2), search (C6), triage (C7), health (C5), OPML (C8), and activity (C9) cards; the rich-content pipeline (`RC-U*`); backend gaps `G3` (offset pagination), `G5` (enclosures), `G6` (feed icons — so C3/C4 keep showing monogram avatars, not real favicons, until this lands), `G7` (readability full-text), `G8` (`comments_url`). The content-rendering decisions (sanitizer, images, embeds) are explicitly not yet made and get hashed out when Phase 2 starts.

### 3. After the real-HA gate passes

Cutting a release is the maintainer's call (per `STATUS.md`) — not automatic once the gate passes.
