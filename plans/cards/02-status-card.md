# C1 — Status Card (`custom:miniflux-status-card`)

**Status:** High-level plan
**Depends on:** F (foundation)
**Role in suite:** the at-a-glance card and the first real proof of the plumbing — entity binding, service quick-actions, confirm dialog.

---

## Purpose

One compact card that answers "how is my Miniflux doing right now?" and hosts the global quick actions. This is the card most users will keep on their main dashboard even if they use nothing else from the suite.

## Integration surface used

| Kind | What | Why |
|---|---|---|
| Entity | `sensor.*_unread_entries` + `by_category` attr | Headline number + category chips |
| Entity | `sensor.*_starred_entries` | Headline number |
| Entity | `sensor.*_feeds_with_errors` (+ `total_feeds`) | Health badge, "N of M feeds" |
| Entity | `binary_sensor.*_reachable` | Online/offline pill; drives DC7 state |
| Service | `refresh_all_feeds` | Quick action |
| Service | `mark_all_read` (`everything: true`) | Quick action — two-step confirm (S5) |
| Service | `count_entries` | Optional configured badges (e.g. "unread today" via `published_within`) |
| Events | any `miniflux_*` | Subtle "activity" flash + refresh nudge (admin only; falls back to entity ticks) |

## Layout (sketch)

```text
┌──────────────────────────────────────────────┐
│ Miniflux                       ● online      │
│                                              │
│   142 unread     37 ★ starred    2 ⚠ errors  │
│                                              │
│ [Tech 87] [News 40] [Comics 15] …    +3 more │  ← category chips (tap → dashboard nav / C2 filter)
│                                              │
│ Updated 2 min ago    [⟳ Refresh] [✓ Mark all]│
└──────────────────────────────────────────────┘
```

Compact mode (config): single row — counts + reachability pill only, no chips/actions.

## Interactions

| Control | Action | Notes |
|---|---|---|
| ⟳ Refresh | `refresh_all_feeds` | Button shows pending until next entity tick; debounce-guarded |
| ✓ Mark all | `mark_all_read {everything: true}` | `<mf-confirm>` with live blast radius from `count_entries {status: [unread]}` |
| Category chip | Configurable: navigate to a dashboard path, or set a filter on a co-located C2 reader card (via the local bus) | Chips come from `by_category` (capped at 100 → `<mf-truncation-notice>`) |
| Error badge | Navigate to configured path (default: wherever C5 lives) | |
| Unread/starred number | Same navigation hook, separately configurable | |

## Card configuration

```yaml
type: custom:miniflux-status-card
# config_entry_id: abc123        # only needed with multiple instances (DC6)
compact: false
show_categories: true            # chips row
max_categories: 8
show_actions: true               # refresh / mark-all buttons
badges:                          # optional count_entries-driven extras
  - label: "today"
    filter: { status: [unread], published_within: { hours: 24 } }
tap_targets:
  unread: /lovelace/reading
  errors: /lovelace/feeds
```

## States & edge cases

- **Offline (DC7):** counts stay (last known), pill goes grey/red, action buttons disabled with tooltip.
- **`by_category` truncated at 100 (S1):** chip row ends with the truncation notice.
- **Mark-all mid-storm (S2/S3):** if the confirm's preview count is stale when confirmed, that's acceptable — the service is scope-based, not id-based, so it stays correct.
- Badge filters are validated in the editor by dry-running `count_entries` and surfacing the integration's own error text.

## Stress-test value

First card to prove: entity subscription, service round-trip, confirm flow, offline degradation, and the multi-instance picker. Its configured `count_entries` badges also give a cheap way to keep periodic query load on the instance during long-running soak tests.

## Acceptance criteria

- Renders meaningful data with **zero configuration** on a single-instance install.
- Mark-all flow: two interactions minimum, preview shows a real count, cancel is a no-op (S5).
- Unplugging Miniflux flips the card to offline within one poll interval; replugging recovers without a reload.
