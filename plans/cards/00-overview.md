# Card Suite — Overview & Architecture

**Status:** High-level plan (input to per-card implementation planning)
**Derived from:** the shipped integration surface — [`../../STATUS.md`](../../STATUS.md), [`../../custom_components/miniflux/services.yaml`](../../custom_components/miniflux/services.yaml), [`../../docs/architecture.md`](../../docs/architecture.md)
**Deliverable:** a suite of 9 Lovelace cards (one JS bundle) that together make every entity, every service, every service *parameter*, and every event of the integration reachable from a dashboard.

---

## 1. Why cards, and why this doubles as the stress test

The integration is deliberately a plumbing layer (architecture D5): sensors are aggregates, lists come only from response-returning services, and events are advisory nudges. Nothing has ever *driven* that surface interactively at human speed and dashboard concurrency. A card suite is the natural stress test because it:

- **Exercises every service from a real client** — not `pytest`, not Developer Tools, but the HA frontend's WebSocket `call_service` with `return_response`, under real auth, real serialization, real payload sizes.
- **Exercises the eventing contract end-to-end** — webhook → integration → HA event bus → live UI update, including bursts.
- **Exposes contract gaps** — planning this suite already surfaced four (see [§6](#6-integration-gaps-this-plan-exposes)). Implementation will surface more; each one feeds back into the integration as a normal TDD change.
- **Creates concurrency the integration has never seen** — five cards on one view all querying, mutating, and reacting to the same instance simultaneously.

**Minimum bar (user requirement):** every operation on a feed and on a category must be *visible and doable* from a card. C3 (feed manager) and C4 (category manager) are that bar; the rest of the suite is what makes this a fully fleshed-out integration rather than a demo.

---

## 2. Decisions

Numbered `DC1…` (decision, cards) in the style of `docs/architecture.md`.

### DC1 — Cards ship inside this repo, served by the integration
One HACS repo can hold one category, and this repo is category *integration*. Rather than a companion `miniflux-ha-cards` plugin repo (two installs, version skew, two release processes), the built bundle is committed at `custom_components/miniflux/frontend/miniflux-cards.js`, the integration registers a static path (`/miniflux/frontend/…`) at setup, and auto-registers it as a Lovelace resource (storage-mode dashboards; YAML-mode users add the resource line manually, documented in `docs/setup.md`). This is the established pattern (Alarmo et al.). **Consequence:** card version is always exactly the integration version — the bundle and backend can never skew.

### DC2 — One bundle, many cards, shared runtime
All 9 cards live in a single `miniflux-cards.js` bundle (Lit + TypeScript, bundled with rollup/esbuild; no runtime CDN fetches). Each card is a custom element (`miniflux-status-card` etc.) registered in `window.customCards` so all appear in the card picker. Shared modules (F, [`01-foundation.md`](./01-foundation.md)): service-call helper, data cache, event/refresh bus, config-entry resolution, common UI atoms (entry row, feed picker, confirm dialog). Cards are thin views over the shared runtime — the same seam discipline the backend uses.

### DC3 — Reads: entities for aggregates, services for lists, never scrape attributes for lists
Cards bind to the 4 entities for cheap always-current aggregates (unread/starred/error counts, reachability) and call query services (`search_entries`, `count_entries`, `get_entries`, `get_feeds`) for anything list-shaped. The capped sensor attributes (`by_category` ≤ 100, error `feeds` ≤ 25) are used only as instant first paint, always replaced by a service query — the caps make them summaries, not sources of truth.

### DC4 — Refresh is event-driven with a poll-tick fallback, never card-side polling
Cards never set their own timers against Miniflux. The refresh bus invalidates cached queries on: (a) the 4 `miniflux_*` HA events, (b) state changes of the integration's own entities (the coordinator's poll tick, visible to every user), (c) local mutations made by any card in the suite. **Constraint discovered in planning:** HA's WebSocket `subscribe_events` only allows non-admin users a fixed allowlist of event types — custom `miniflux_*` events are admin-only. So (b) is not a nicety; it is the *only* live signal for non-admin users, and every card must be fully functional on it alone.

### DC5 — Mutations are optimistic with rollback, and destructive operations are two-step
Entry-level mutations (`update_entries`) apply to the local cache immediately and roll back with a toast on service error. Destructive/blast-radius calls — `delete_feed`, `delete_category`, `mark_all_read` (especially `everything: true`), `import_opml` — always require an explicit in-card confirm step showing the concrete blast radius ("Delete *Ars Technica* and its 1,204 entries?"). No card ever auto-fires a destructive service from a config option.

### DC6 — Every card takes an optional `config_entry_id`; single-instance is zero-config
Mirrors the service layer's own convention: omitted `config_entry_id` resolves to the sole Miniflux config entry; with multiple instances the card editor requires a pick. Two cards pointed at two instances on one dashboard must not share caches (cache is keyed per entry).

### DC7 — Cards degrade honestly
When `binary_sensor.*_reachable` is `off`, cards show a distinct offline state (last-known data, greyed actions) rather than spinners or blank panes. Service errors surface the integration's own translated error messages verbatim — the backend already maps HTTP to typed errors; cards don't re-invent copy.

---

## 3. Data-access patterns (shared by all cards)

| Need | Mechanism | Notes |
|---|---|---|
| Aggregate counts, reachability | Entity state + attributes via `hass.states` | Free, always current, drives first paint |
| Entry lists | `search_entries` via WS `call_service` + `return_response` | `include_content: false` always; content hydrated on demand |
| Entry content | `get_entries` (`include_content: true`) | Chunk to `HYDRATE_IDS_MAX` (100) |
| Feed lists | `get_feeds` | Cached aggressively; invalidated on feed CRUD + poll tick |
| Counts without payload | `count_entries` | Used for badges and blast-radius previews |
| Mutations | `update_entries` (chunk to `UPDATE_IDS_MAX` = 500), `mark_all_read`, feed/category CRUD | Optimistic per DC5 |
| Live updates (admin) | `subscribeEvents` on the 4 `miniflux_*` types | Debounced ≥ 2s before re-query — webhook bursts must not become query storms |
| Live updates (everyone) | `subscribeEntities` on the 4 integration entities | The poll-tick fallback (DC4) |

**Pagination:** `search_entries` has `limit` (max 500) but **no offset** — see gap G3. Until that lands, cards paginate by cursor: repeat the query with `published_before` = oldest loaded timestamp, `direction: desc`, dropping already-seen ids (equal-timestamp duplicates are possible and must be deduped client-side).

---

## 4. Coverage matrix — every service, parameter, and event mapped to a card

The stress-test doctrine: **a service parameter no card can drive is untested surface.** This matrix is the checklist; C-numbers refer to the card docs.

| Service | Cards | Parameter coverage notes |
|---|---|---|
| `search_entries` | C2 reader, C6 search, C7 triage | C6 exposes *every* field incl. `published_within`/`after`/`before`, `order`, `direction`, `limit` 1↔500, `include_content` both ways |
| `count_entries` | C1 status, C4 categories, C6 search | C6 mirrors its full filter set; C3/C4 use it for blast-radius previews |
| `get_entries` | C2 reader, C7 triage | `include_content` both ways; `missing` ids surfaced (stale-cache case) |
| `get_feeds` | C3 feeds, C5 health, F pickers | `category` filter (C3 group-by), `only_with_errors` (C5) |
| `update_entries` | C2 reader, C7 triage | All 3 statuses incl. `removed`; `starred` both ways; batch chunking at 500 |
| `mark_all_read` | C1 (`everything`), C3 (`feed`), C4 (`category`) | All three scopes, each from its natural home |
| `create_feed` | C3 | With/without `category`, `crawler` both ways |
| `update_feed` | C3 | `title`, `category` (move), `feed_url`, `disabled`, `crawler` — each editable |
| `delete_feed` | C3 | Two-step confirm w/ entry-count preview |
| `refresh_feed` | C3, C5 | Health card's "retry now" |
| `refresh_all_feeds` | C1, C3 | |
| `discover_feeds` | C3 | Add-feed wizard step 1 |
| `create_category` | C4 | Also inline from C3's add/edit feed flow |
| `update_category` | C4 | Rename |
| `delete_category` | C4 | Two-step confirm w/ feed-count preview |
| `export_opml` | C8 | Response → client-side file download |
| `import_opml` | C8 | Paste or local file → text; confirm w/ preview |

| Event | Cards | Use |
|---|---|---|
| `miniflux_new_entries` | C2, C7, C1 (refresh); C9 (display) | Live list refresh |
| `miniflux_entry_saved` | C2 (badge), C9 | |
| `miniflux_feed_error` | C5 (live), C9 | |
| `miniflux_feed_recovered` | C5 (live), C9 | |

| Entity | Cards |
|---|---|
| `sensor.*_unread_entries` (+ `by_category`) | C1, C2 header, C4 counts (first paint) |
| `sensor.*_starred_entries` | C1, C2 |
| `sensor.*_feeds_with_errors` (+ `feeds`, `truncated`, `total_feeds`) | C1, C5 |
| `binary_sensor.*_reachable` | all (DC7); C1 and C5 display it explicitly |

---

## 5. Stress-test scenarios the suite must survive

Each becomes an acceptance item on the relevant card(s):

- **S1 — Scale:** 500+ feeds, 10k+ unread. Lists virtualize; `by_category` truncation at 100 and error-feed truncation at 25 must be *visibly* handled (a "showing first N — refine" affordance), never silently wrong.
- **S2 — Event storm:** a `refresh_all_feeds` triggering dozens of webhook deliveries in seconds. Debounced re-query (DC4); the UI settles to a correct final state.
- **S3 — Miniflux down:** reachability `off` mid-session. Offline states per DC7; queued/optimistic mutations roll back cleanly.
- **S4 — Concurrent mutation:** reader and triage cards open together; marking read in one updates the other (local bus) without waiting for the next poll.
- **S5 — Destructive safety:** delete/import/mark-everything flows cannot be triggered with fewer than two deliberate interactions, and previews show real counts.
- **S6 — Parameter sweep:** C6 can produce a service call containing every `search_entries` field simultaneously, and the result renders.
- **S7 — Multi-instance:** two config entries, cards for each on one view; no cache or event cross-talk.
- **S8 — Slow network:** 30s API timeout upstream; every in-flight call has a visible pending state and is cancellable/ignorable, and stale responses never overwrite newer ones (request generation counter).
- **S9 — Non-admin user:** no custom-event subscription (DC4); every card still converges on poll-tick refresh.
- **S10 — Nasty content:** entry titles/content with scripts, RTL text, 10k-char titles, broken images. Content renders sanitized (no live scripts), truncation is CSS not data mutation.

---

## 6. Integration gaps this plan exposes

Found while mapping cards onto the shipped surface — each is a candidate backend change, to be built with the integration's normal TDD process **before** the card that needs it:

- **G1 — No `get_categories` service.** Categories are only observable via feeds (`get_feeds` → `category_id`/`category_title`) and the capped `by_category` attribute. An **empty category is invisible**, so C4 cannot render it, and it can't be picked as a `create_feed` target. Backend already hits `/v1/categories` at poll time. *Proposed:* `get_categories` returning `{categories: [{id, title, feed_count, unread}]}`.
- **G2 — `get_feeds` lacks per-feed unread counts.** The coordinator already fetches `/v1/feeds/counters` each poll; the data exists in the snapshot but isn't exposed. C3 wants an unread badge per feed without N× `count_entries`. *Proposed:* add `unread` (and `read`?) to `_feed_to_dict` from the snapshot's counters.
- **G3 — `search_entries` has no `offset`.** True pagination is impossible; the cursor workaround (§3) has an equal-timestamp dedup wart. Miniflux's API supports `offset` natively. *Proposed:* add optional `offset` (0-based) to `search_entries`.
- **G4 — Custom events are admin-only in the frontend** (HA core's WS allowlist). Not fixable in this integration — recorded here as the reason DC4 mandates the entity-tick fallback path, and worth a note in `docs/setup.md`.

---

## 7. Build order

F first (everything depends on it), then cards ordered so each proves new plumbing:

| Order | Unit | Proves |
|---|---|---|
| 1 | **F** foundation | Delivery (DC1), bundle, resource auto-registration, service helper round-trip |
| 2 | **C1** status | Entity binding, first service calls, quick actions, confirm dialog |
| 3 | **C2** reader | List queries, hydration, optimistic mutation, cursor pagination, event refresh |
| 4 | **C3** feed manager | Full CRUD + wizard flows; needs G2 first |
| 5 | **C4** category manager | Needs **G1** first |
| 6 | **C5** health | Error attributes, retry, live error/recovered events |
| 7 | **C6** search | Full parameter sweep (S6) |
| 8 | **C7** triage | Keyboard/touch interaction, undo stack |
| 9 | **C8** OPML | File download/upload handling |
| 10 | **C9** activity | Event tail; the observer used while stress-testing everything else |

**Testing posture (high level; detailed per card at pickup):** shared runtime gets unit tests (Vitest) against a mocked `hass`; each card gets rendering + interaction tests; the backend gap changes (G1–G3) get the usual pytest TDD treatment; a manual stress-test script per §5 runs against the live instance with C9 open as the observer.
