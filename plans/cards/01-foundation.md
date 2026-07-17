# F — Frontend Foundation (shared runtime, no user-visible card)

**Status:** High-level plan
**Depended on by:** every card (C1–C9)
**Backend touchpoints:** static-path + Lovelace-resource registration in `__init__.py` (the only integration-code change in this unit)

---

## Purpose

Everything the nine cards share, built once: how the JS reaches the browser, how cards talk to the integration, how they stay fresh, and the UI atoms they compose. Cards stay thin views; the foundation owns all plumbing — the frontend mirror of the backend's seam discipline.

---

## Deliverables

### 1. Delivery (DC1)

- `custom_components/miniflux/frontend/miniflux-cards.js` — the committed, built bundle.
- On integration setup: register the static path and auto-add the Lovelace resource (storage mode) with a cache-busting `?v=<integration version>` query; idempotent across restarts and version bumps. YAML-mode dashboards: documented manual resource line in `docs/setup.md`.
- Source lives in-repo under `frontend/src/` (TypeScript + Lit); build via esbuild/rollup, output committed on release. CI check: committed bundle matches a fresh build (no stale-bundle releases).

### 2. `MinifluxApi` — service-call helper

One typed wrapper per service (all 17), over the WS `call_service` + `return_response` path. Owns:

- **Config-entry resolution (DC6):** finds Miniflux config entries from the entity/device registry; auto-selects when there's exactly one; exposes the list to card editors.
- **Chunking:** transparently splits `get_entries` at `HYDRATE_IDS_MAX` (100) and `update_entries` at `UPDATE_IDS_MAX` (500), merging responses.
- **Error normalization:** one error shape `{message, retriable}` derived from HA's error response — cards render `message` verbatim (DC7), never parse it.
- **Request generations (S8):** stale responses (an older in-flight query resolving after a newer one) are dropped, never rendered.

### 3. `MinifluxStore` — cache + refresh bus (DC3/DC4)

- Query cache keyed by `(config_entry_id, service, canonical params)`; feed list and category list cached with long TTL, entry queries with short TTL.
- **Invalidation inputs:** (a) `subscribeEvents` on the 4 `miniflux_*` types when the user is admin, debounced ≥2s (S2); (b) `subscribeEntities` on the integration's 4 entities — the universal poll-tick signal (G4/S9); (c) a local mutation bus — any card's successful mutation invalidates affected keys immediately (S4).
- **Optimistic layer (DC5):** entry mutations patch cached rows synchronously; on service failure the patch reverts and an error toast fires. Feed/category CRUD is *not* optimistic (server assigns ids/side effects) — those show pending state and re-query.
- Per-entry-id isolation: two instances never share a cache (S7).

### 4. UI atoms

| Atom | Used by | Notes |
|---|---|---|
| `<mf-entry-row>` | C2, C6, C7 | Title, feed, age, star/read state, action icons; sanitized rendering (S10) |
| `<mf-content-view>` | C2, C7 | Sanitized HTML entry content (strip scripts/handlers; images optional per config) |
| `<mf-feed-picker>` / `<mf-category-picker>` | C3, C4, C6, editors | Backed by cached `get_feeds` / `get_categories` (G1) |
| `<mf-confirm>` | C1, C3, C4, C8 | Two-step destructive confirm with blast-radius line (DC5/S5) |
| `<mf-offline>` | all | Standard offline banner bound to the reachability sensor (DC7) |
| `<mf-truncation-notice>` | C1, C5 | "Showing first N — refine" for capped data (S1) |
| Virtualized list | C2, C6, C7 | Windowed rendering for 500-row results (S1) |

### 5. Card registration + editors

- Every card: `customElements.define`, `window.customCards.push` (picker metadata), `getConfigElement()`/`getStubConfig()` for the visual editor, `getCardSize()`/`getGridOptions()` for sections-view sizing.
- Shared editor base handles the `config_entry_id` picker (hidden when only one instance) and common toggles, so per-card editors declare only their own options.

---

## Acceptance criteria

- Fresh install (HACS → add integration → open dashboard) shows all 9 cards in the picker with **zero manual resource setup** on storage-mode dashboards.
- A `search_entries` round-trip from the browser returns typed entries; killing Miniflux mid-flight yields a normalized error, not an unhandled rejection.
- With two cards mounted, one mutation updates both within one frame of the service response (S4); with a non-admin user, both still converge after the next coordinator poll (S9).
- Bundle loads with no external network requests and no globals leaked beyond the custom elements + `window.customCards` entries.

## Open questions (resolve at pickup)

- Sanitizer choice for entry HTML (hand-rolled allowlist vs. vendored lib) — bundle-size vs. rigor trade-off; S10 is the gate either way.
- Whether resource auto-registration needs a Repair issue when it fails (YAML mode) or a log line + docs suffices.
