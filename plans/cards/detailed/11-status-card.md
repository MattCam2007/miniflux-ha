# C1 — Status Card — Units & Usage

> **🟡 PHASE 2 — DEFERRED.** Not part of the minimum-bar Phase 1 (C3/C4 only, decision **D‑1** in [`00-START-HERE.md`](./00-START-HERE.md)). Do not build during Phase 1.

**High-level source:** [`../02-status-card.md`](../02-status-card.md). First real proof of the plumbing: entity binding, service quick-actions, confirm dialog.
**Depends on:** F (all), `<mf-confirm>` (F-U9), truncation notice (F-U11).

---

## Units

### `C1-U1` — Card shell + entity binding + zero-config render
**Depends on:** F-U13, F-U6
**Deliverable:** `miniflux-status-card` rendering headline counts + reachability from entities, no config required.
**Behavior:** reads `sensor.*_unread_entries`, `*_starred_entries`, `*_feeds_with_errors` (+`total_feeds`), `binary_sensor.*_reachable`; single-instance zero-config; multi-instance uses the resolved entry.
**Tests:** renders 3 counts + reachability pill from `FakeHass.states`; zero config on one instance; picks the right entities for a given `config_entry_id`; missing entity → graceful dash, not crash.

### `C1-U2` — Category chips from `by_category` + truncation
**Depends on:** C1-U1, F-U11
**Behavior:** chips from the `by_category` attribute (cap 100 → `<mf-truncation-notice>`); `max_categories` config; tap emits a bus filter or navigates (C1-U4).
**Tests:** N chips rendered; >`max_categories` collapses to "+N more"; cap-100 attribute → truncation notice; empty attribute → no chip row.

### `C1-U3` — Quick actions: refresh-all + mark-all (two-step) 
**Depends on:** C1-U1, F-U9, F-U4
**Behavior:** ⟳ → `refresh_all_feeds`, pending until next entity tick, debounce-guarded; ✓ → `<mf-confirm>` with live blast radius from `count_entries {status:[unread]}` → `mark_all_read {everything:true}`.
**Tests:** refresh calls the service once, shows pending, clears on tick; mark-all needs confirm (≥2 interactions); confirm preview shows a real count; cancel → no call; stale preview count still fires correctly (scope-based).

### `C1-U4` — Navigation / bus tap targets + compact mode
**Depends on:** C1-U2
**Behavior:** `tap_targets` map unread/errors/chip taps to dashboard paths **or** push a filter to a co-located C2 via the local bus; `compact` mode = single counts+pill row.
**Tests:** unread tap navigates to configured path; chip tap emits bus filter payload; compact hides chips/actions; error badge → configured path.

### `C1-U5` — Configured `count_entries` badges + offline
**Depends on:** C1-U1, F-U4, F-U11
**Behavior:** optional `badges` each run `count_entries` with a filter (e.g. `published_within`); editor dry-runs the filter and surfaces backend error text; offline (`DC7`) → last-known counts, grey pill, disabled actions.
**Tests:** badge renders a count from `count_entries`; bad filter → backend error verbatim in editor; offline → actions disabled + tooltip, counts retained.

---

## Usage — `custom:miniflux-status-card`

At-a-glance totals, reachability, and global quick actions. The card most users keep on their main dashboard.

```yaml
type: custom:miniflux-status-card
# config_entry_id: abc123      # only with multiple Miniflux instances
compact: false                 # true → single row: counts + reachability only
show_categories: true          # category chip row (from by_category attribute)
max_categories: 8              # overflow collapses to "+N more"
show_actions: true             # refresh-all + mark-all buttons
badges:                        # optional count_entries-driven extras
  - label: "today"
    filter: { status: [unread], published_within: { hours: 24 } }
tap_targets:                   # navigate OR push a filter to a co-located reader card
  unread: /lovelace/reading
  errors: /lovelace/feeds
```

| Option | Type | Default | Notes |
|---|---|---|---|
| `config_entry_id` | string | auto | Required only with >1 instance |
| `compact` | bool | `false` | Minimal single-row layout |
| `show_categories` | bool | `true` | Chips from `by_category` (capped at 100 → truncation notice) |
| `max_categories` | int | `8` | Chips shown before "+N more" |
| `show_actions` | bool | `true` | Refresh-all / mark-all-read |
| `badges` | list | `[]` | Each `{label, filter}` → a `count_entries` badge |
| `tap_targets` | map | — | Keys `unread`/`starred`/`errors`; value = dashboard path or `bus:` filter |

**Behavior notes**
- **Mark all read** is destructive (`everything:true`): it always requires an explicit confirm showing the current unread count. Cancel does nothing.
- **Offline:** when Miniflux is unreachable, counts show last-known values, the pill goes grey/red, and action buttons disable.
- **Non-admin users** still get live-ish updates via the coordinator poll tick (custom events are admin-only — `G4`).
- Badge filters are validated in the visual editor by dry-running `count_entries`; an invalid filter shows Miniflux's own error text.

**Acceptance:** meaningful data with zero config on a single instance; mark-all needs ≥2 interactions with a real preview; unplugging Miniflux flips to offline within one poll interval and recovers without reload.
