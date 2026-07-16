# Phase 4 — Entities (sensors + reachability)

**Goal:** the four dashboard/automation-visible entities, each a **pure projection** over `coordinator.data` (a `Snapshot`). No entity calls the client (seam rule 1). This phase is small and mechanical *because* Phase 1 (rollup) and Phase 3 (coordinator) did the work; entities just render.

**Depends on:** Phase 3 (coordinator + device), Phase 1 (Snapshot), Phase 0 (const caps).
**Produces:** `entity.py` (base + device), `sensor.py`, `binary_sensor.py`.
**Tested with:** inject a `Snapshot` into a coordinator (or a fake coordinator) and assert entity state/attributes — **no HTTP, no client**.
**Architecture refs:** §3.6 (entity table), D3 (cardinality: aggregate entities + attributes, not per-feed/per-category entities), R5 (caps), R8 (per-category revisit hook).

Order: 4.1 base/device → 4.2–4.5 the entities (independent of each other; any order, but list order is fine).

---

## Chunk 4.1 — Base entity + device

**Purpose:** one HA device per config entry representing the Miniflux instance (§3.6), and a shared `CoordinatorEntity` base carrying availability wiring.

**Public surface:**
- `MinifluxEntity(CoordinatorEntity[MinifluxCoordinator])` base: sets `_attr_has_entity_name = True`, `device_info` (identifiers = entry unique id; name; `configuration_url` = instance base URL; `sw_version` from coordinator's tracked version; manufacturer "Miniflux").
- stable `unique_id` scheme per entity: `f"{entry_unique_id}_{key}"`.

**Tests first (red):**
- device_info identifiers/name/sw_version populated from coordinator/entry.
- entity unique_ids stable and distinct across the four entities.

**DoD:** device registered once; all four entities attach to it.

---

## Chunk 4.2 — Unread sensor

**Purpose:** primary pipeline-depth signal (§3.6), with per-category breakdown as an **attribute** (D3 — not separate entities).

**Public surface:**
- `sensor.miniflux_unread_entries`: `native_value = snapshot.unread_total`; `state_class = measurement`; attribute `by_category = snapshot.unread_by_category[:BY_CATEGORY_ATTR_CAP]`.

**Tests first (red):**
- state equals `unread_total` from an injected snapshot.
- `by_category` attribute mirrors the snapshot rollup, capped at `BY_CATEGORY_ATTR_CAP`.
- unavailable when coordinator update failed (see 4.5 for the availability rule interaction).

**DoD:** state + capped attribute correct; pure over injected snapshot.

---

## Chunk 4.3 — Starred sensor

**Purpose:** human-flagged queue depth / engagement signal (§3.6; architecture "engagement" note — starred is the queryable engagement surface).

**Public surface:**
- `sensor.miniflux_starred_entries`: `native_value = snapshot.starred_total`; `state_class = measurement`.

**Tests first (red):**
- state equals `starred_total`; updates when the injected snapshot changes.

**DoD:** trivial and green.

---

## Chunk 4.4 — Feeds-with-errors sensor

**Purpose:** make a broken feed visible instead of silently stale (architecture Feed-health requirement; §3.6). Count as state, details as capped attribute (D3 — one sensor, not per-feed entities).

**Public surface:**
- `sensor.miniflux_feeds_with_errors`: `native_value = len(snapshot.error_feeds)`; attributes `feeds = [{id,title,category_title,parsing_error_count,parsing_error_message,checked_at}][:ERROR_FEEDS_ATTR_CAP]`, `truncated = bool`, `total_feeds = len(snapshot.feeds)`.

**Tests first (red):**
- state equals count of error feeds.
- `feeds` attribute lists error feeds (deterministic order from rollup 1.7), capped at `ERROR_FEEDS_ATTR_CAP` with `truncated True` when over.
- zero errors → state 0, `feeds == []`, `truncated False`.

**DoD:** count + capped detail + truncated flag correct; automation trigger `state > 0` documented for setup.md linkage.

---

## Chunk 4.5 — Reachability binary sensor

**Purpose:** the diagnostic that stays truthful when polls fail — it **overrides availability** so it's present when everything else is `unavailable` (architecture §3.6, D10).

**Public surface:**
- `binary_sensor.miniflux_reachable`: `device_class = connectivity`; `is_on = coordinator.last_update_success`; `available` **always True** (override — it must report the outage, not vanish into it). Attributes: `last_success_at`, `last_error`, `last_webhook_at`, `server_version`.

**Tests first (red):**
- successful coordinator → `on`, `available True`, `last_success_at` set.
- failed coordinator update → this sensor `off` but **still available**, while the content sensors (4.2–4.4) report `unavailable`.
- `last_webhook_at` reflects coordinator's tracked webhook timestamp (set by Phase 6 via `note_webhook`; here tested by poking the coordinator field).
- `server_version` surfaced from coordinator.

**DoD:** the availability-override asymmetry (this sensor available while others aren't) is explicitly tested — it's the whole point of the entity (D10).

---

## Phase 4 exit criteria

- Four entities on one device; states/attributes are pure functions of the injected snapshot (no client in any entity test).
- Caps (`BY_CATEGORY_ATTR_CAP`, `ERROR_FEEDS_ATTR_CAP`) and truncation flags enforced from `const` (R5).
- Reachability sensor stays available during outages while content sensors go unavailable (D10) — the acceptance test for "degraded states are visible."
- R8 hook noted: if per-category *history* is ever needed, add opt-in per-category sensors without breaking the `by_category` attribute contract — recorded in the Deviations footer, not built.
