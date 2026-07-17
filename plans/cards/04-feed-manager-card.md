# C3 — Feed Manager Card (`custom:miniflux-feed-manager-card`)

**Status:** High-level plan
**Depends on:** F (foundation); **G2** (per-feed unread counts in `get_feeds`) should land first
**Role in suite:** the "see and do **all** operations on a feed" card — the minimum-bar requirement, in one place.

---

## Purpose

Complete feed administration from a dashboard: browse every feed with live status, add feeds via discovery, edit every mutable property, refresh, and delete. After this card ships, a user never needs the Miniflux web UI for feed management.

## Integration surface used

| Kind | What | Why |
|---|---|---|
| Service | `get_feeds` | The list; `category` filter for group-by; `only_with_errors` for the error filter chip |
| Service | `discover_feeds` | Add-feed wizard step 1: site URL → candidate feeds |
| Service | `create_feed` | Add-feed wizard step 2 (`feed_url`, `category`, `crawler`) |
| Service | `update_feed` | Edit sheet: `title`, `category` (move), `feed_url`, `disabled`, `crawler` |
| Service | `delete_feed` | Delete flow (two-step, S5) |
| Service | `refresh_feed` / `refresh_all_feeds` | Per-row and toolbar refresh |
| Service | `count_entries {feed: id}` | Delete-confirm blast radius; unread badge fallback until G2 |
| Service | `mark_all_read {feed: id}` | Row action |
| Service | `create_category` | Inline "new category…" option inside the category picker |
| Entity | `sensor.*_feeds_with_errors` | Error filter chip badge |

Covers **9 of the 17 services** — the widest single card.

## Layout (sketch)

```text
┌─────────────────────────────────────────────────────┐
│ Feeds (63)   [All ▾] [⚠ 2]  [＋ Add feed]  [⟳ All]  │
│ ▾ Tech (24)                                         │
│   Ars Technica          12 unread   2h ago    ⟳ ⋮   │
│   Rust Blog ⏸           —  disabled           ⟳ ⋮   │
│   Broken Feed ⚠         parse error ×14       ⟳ ⋮   │
│ ▸ News (18)                                         │
│ …                                                   │
└─────────────────────────────────────────────────────┘
⋮ menu: Edit · Mark all read · Refresh · Disable/Enable · Delete
```

Row shows: title, unread badge (G2), disabled ⏸ / error ⚠ state, `checked_at` age. Tap row → detail/edit sheet.

## Key flows

**Add feed (wizard, in-card modal):**
1. Paste site or feed URL → `discover_feeds` → candidate list (title, type, URL). Direct feed URLs skip ahead.
2. Pick candidate → choose category (`<mf-category-picker>` with inline create) + crawler toggle → `create_feed`.
3. Success → list re-query, new row highlighted; failure → backend error verbatim (bad URL, duplicate, unreachable — this flow is a natural error-path stress test).

**Edit sheet:** every `update_feed` field as a form — title text, category picker (move), feed URL (with "this changes the source" caution), disabled toggle, crawler toggle. Only dirty fields are sent.

**Delete:** ⋮ → Delete → `<mf-confirm>` shows "Delete *X* and its N entries?" (N via `count_entries`) → `delete_feed`. Optional `require_hold: true` config for hold-to-confirm.

**Refresh:** per-row ⟳ fires `refresh_feed` and marks the row pending until the next poll tick updates `checked_at`; toolbar ⟳ fires `refresh_all_feeds` (debounce-guarded — this is the S2 storm trigger).

## Card configuration

```yaml
type: custom:miniflux-feed-manager-card
group_by: category         # category | none
category: Tech             # optional hard scope
show_add: true
show_delete: true          # hide destructive ops entirely for display-only dashboards
require_hold: false        # hold-to-confirm on delete
height: 520px
```

## States & edge cases

- **Feed without category** (fixture edge case): renders in an "Uncategorized" group.
- **Disabled feed:** distinct style; the only ⋮ mutation offered prominently is Enable.
- **Delete while a C2 reader shows that feed's entries** (S4): mutation bus invalidates entry queries; the reader's rows for the dead feed disappear on its re-query, and `get_entries` `missing` handling covers the race.
- **Rename/move:** optimistic label update, but the category move re-queries (server recomputes `category_title`).
- **Duplicate `create_feed`:** backend's typed error surfaces as-is; wizard stays open for correction.

## Stress-test value

Drives every feed-lifecycle path the integration has, including the full error taxonomy of `create_feed`/`discover_feeds` (bad URLs, auth walls, non-feed pages) and the refresh-storm scenario (S2). The delete→reader-race is the sharpest concurrent-mutation test in the suite (S4).

## Acceptance criteria

- Every operation the integration supports on a feed is reachable from this card: create (with discovery), read (all `_feed_to_dict` fields visible in the detail sheet), update (all 5 mutable fields), delete, refresh, mark-read. **Zero gaps.**
- Add-feed wizard: URL → subscribed in ≤ 3 interactions for the happy path.
- Delete requires ≥ 2 interactions and shows a real entry count (S5).
- 500-feed instance renders grouped and scrolls smoothly (S1).
