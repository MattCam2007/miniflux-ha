# C2 — Reader Card (`custom:miniflux-reader-card`)

**Status:** High-level plan
**Depends on:** F (foundation); benefits from G3 (`offset`) but ships with cursor pagination without it
**Role in suite:** the flagship. If a user installs one interactive card, it's this one: browse entries, read them, act on them — a small RSS reader inside a dashboard tile.

---

## Purpose

A scrollable, filterable entry list with inline reading and per-entry actions. Not a full Miniflux replacement (no settings, no user management) — a *reading and triage surface* sized for a dashboard.

## Integration surface used

| Kind | What | Why |
|---|---|---|
| Service | `search_entries` (`include_content: false`) | The list; filter preset from config + toolbar |
| Service | `get_entries` (`include_content: true`) | On-demand content hydration when a row expands |
| Service | `update_entries` | Read/unread toggle, star/unstar, remove — single and multi-select |
| Service | `mark_all_read` (`feed`/`category` scope) | "Mark view read" when the active filter is exactly one feed or category |
| Entity | `sensor.*_unread_entries` | Header count for the active scope's first paint |
| Events | `miniflux_new_entries` (admin) / entity ticks (everyone) | Live "N new entries — refresh" banner (DC4) |

## Layout (sketch)

```text
┌────────────────────────────────────────────────────┐
│ Unread ▾   [All ▾ feeds] [🔍]        142   ⋮       │  ← view toolbar
│ ── 3 new entries — refresh ──────────────────────  │  ← live banner (only on activity)
│ ● How GPS works              Ars Technica  12m  ★☆ │
│ ● Rust 1.90 released         This Wk Rust   1h  ☆  │
│   ▸ expanded: sanitized content, author,           │
│     reading time, [Open ↗] [Mark unread] [★] [🗑]  │
│ ○ Weekly roundup             Lobsters       3h  ☆  │
│   … (virtualized)                                  │
│ [Load more]                                        │
└────────────────────────────────────────────────────┘
```

## Interactions

| Control | Action | Notes |
|---|---|---|
| View selector | Presets: Unread / Starred / All / History (read) | Each is a canned `search_entries` filter |
| Feed/category filter | `<mf-feed-picker>` / `<mf-category-picker>` scoping the query | |
| 🔍 | Inline text search → `search: <q>` on the current filter | Debounced 400ms |
| Row tap | Expand + hydrate via `get_entries`; auto-mark-read on expand (config, default on) | Hydration cached; `missing` ids → row removed with toast (stale cache) |
| ★ | `update_entries {starred: toggle}` | Optimistic (DC5) |
| Read dot | `update_entries {status: read|unread}` | Optimistic |
| 🗑 | `update_entries {status: removed}` | Optimistic w/ 5s undo toast (re-set previous status) |
| Long-press / checkbox mode | Multi-select → bulk star/read/remove | Exercises `UPDATE_IDS_MAX` chunking |
| ⋮ → Mark view read | `mark_all_read` scoped to the active feed/category; falls back to bulk `update_entries` over loaded ids for compound filters | Confirm when scope > loaded rows |
| Open ↗ | `window.open(entry.url)` | Never navigates the dashboard away |
| Load more | Cursor pagination (§3 of overview) until G3 lands | Dedup on id |

## Card configuration

```yaml
type: custom:miniflux-reader-card
default_view: unread            # unread | starred | all | history
filter:                         # optional hard scope (a "Tech news" card)
  category: Tech
page_size: 50                   # 1..500
height: 480px                   # scroll area; omit = grow with content
show_toolbar: true
auto_mark_read_on_expand: true
show_images: true               # in expanded content
listen_bus: true                # accept filter pushes from C1 chips / C6 saved searches
```

## States & edge cases

- **Empty view:** friendly zero state per preset ("Inbox zero 🎉" vs "No starred entries").
- **Offline (DC7):** list stays, action icons disabled, banner explains.
- **Optimistic rollback:** star fails → icon reverts + toast with backend message.
- **Event storm (S2):** banner counts accumulate; refresh is one re-query, not one per event.
- **Nasty content (S10):** all content through `<mf-content-view>` sanitizer; titles clamp by CSS.
- **Cross-card sync (S4):** mutations flow through the store; a C7 triage action updates this list without re-query.

## Stress-test value

The heaviest single consumer: sustained `search_entries` + `get_entries` + `update_entries` traffic, pagination against real data volumes, optimistic-rollback paths, and the event→refresh loop. Bulk multi-select is the only UI that naturally drives 500-id `update_entries` batches. This card is where G3 (offset) pain will be felt first and measured.

## Acceptance criteria

- 10k-unread instance: initial paint < 1s after service response; scroll stays smooth (virtualized) (S1).
- Expand → read → collapse round-trip updates the unread count on C1 within one poll tick, and instantly when the local bus is active.
- Remove + undo restores the entry's exact prior status (unread vs read).
- Non-admin user gets the "new entries" banner within one coordinator poll of a webhook burst (S9).
