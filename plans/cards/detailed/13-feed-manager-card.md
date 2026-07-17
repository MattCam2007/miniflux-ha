# C3 — Feed Manager Card — Units & Usage

> **🟢 PHASE 1 — BUILD NOW.** One of the two minimum-bar cards ([`00-START-HERE.md`](./00-START-HERE.md), decision **D‑1**). **Baked decisions:** `require_hold` default **false** (feed delete = confirm dialog only, **D‑4**); unread badge sourced from **`G2`** snapshot join (**D‑6**); **no feed favicons** in Phase 1 (`G6` deferred) — use a letter/monogram avatar; single instance, zero-config (**D‑3**).

**High-level source:** [`../04-feed-manager-card.md`](../04-feed-manager-card.md). The "see and do **all** operations on a feed" card — the minimum-bar requirement. Covers 9 of 17 services.
**Depends on:** F (foundation atoms C3 uses), `<mf-confirm>` (F-U9), pickers (F-U10); **`G2`** (per-feed unread counts) lands first. Feed icons (`G6`/RC-U7) are **Phase 2** — Phase 1 uses a monogram avatar.

---

## Units

### `C3-U1` — Feed list, grouping, feed rows
**Depends on:** F-U13, F-U6 (**not** RC-U7 — no icons in Phase 1)
**Behavior:** `get_feeds` list, `group_by: category|none`, rows show a **monogram/letter avatar** + title (real favicons are Phase 2, `G6`), unread badge from **`G2`** (snapshot join, "as of last poll"), disabled ⏸ / error ⚠ state, `checked_at` age; "Uncategorized" group for feeds without a category.
**Tests:** grouped render; uncategorized group present; disabled/error styles; unread badge from `G2` (`unread:0` when a feed has no snapshot count); monogram avatar rendered; age from `checked_at`.

### `C3-U2` — Add-feed wizard (discover → create)
**Depends on:** C3-U1, F-U10
**Behavior:** step 1 `discover_feeds` (site URL → candidates; direct feed URL skips ahead); step 2 pick candidate → category picker (inline `create_category`) + crawler toggle → `create_feed`; success highlights new row; errors (bad URL, duplicate, unreachable) surface verbatim, wizard stays open.
**Tests:** discover → candidate list; direct feed URL skips step 1; create with/without category, crawler both ways; duplicate/bad-URL error keeps wizard open with the message; inline category create then usable as target.

### `C3-U3` — Edit sheet (all mutable fields)
**Depends on:** C3-U1
**Behavior:** form over `update_feed` — `title`, `category` (move), `feed_url` (with "changes the source" caution), `disabled`, `crawler`; only dirty fields sent; rename optimistic label, category move re-queries (server recomputes `category_title`).
**Tests:** only changed fields in the call; rename optimistic + rollback; move re-queries; feed_url change shows caution; enable/disable toggles.

### `C3-U4` — Row actions: refresh, mark-read, enable/disable, delete
**Depends on:** C3-U1, F-U9
**Behavior:** per-row ⟳ `refresh_feed` (pending until `checked_at` tick); toolbar ⟳ `refresh_all_feeds` (debounce-guarded, `S2`); ✓ `mark_all_read {feed}`; enable/disable via `update_feed`; 🗑 `<mf-confirm>` "Delete *X* and its N entries?" (N via `count_entries`) → `delete_feed`, `require_hold` honored; `show_delete:false` hides destructive ops.
**Tests:** refresh row pends then clears on tick; delete needs confirm with a real entry count; `show_delete:false` hides delete; mark-read scoped to the feed; disable moves row to silenced style.

### `C3-U5` — Concurrency & edge cases
**Depends on:** C3-U4, F-U7
**Behavior:** delete while a C2 shows that feed's entries (`S4`) → bus invalidates entry queries, reader drops dead rows on re-query, `get_entries missing` covers the race; 500-feed instance renders grouped and scrolls (`S1`, via F-U12).
**Tests:** delete emits bus invalidation for feed + entry keys; 500 feeds virtualized; disabled feed offers Enable prominently.

---

## Usage — `custom:miniflux-feed-manager-card`

Complete feed administration from a dashboard — after this card, you never need Miniflux's web UI for feeds.

```yaml
type: custom:miniflux-feed-manager-card
group_by: category         # category | none
category: Tech             # optional hard scope
show_add: true             # add-feed wizard
show_delete: true          # false → hide destructive ops (display-only dashboards)
require_hold: false        # hold-to-confirm on delete (default off — D-4)
height: 520px
# show_feed_icons:         # Phase 2 (needs G6); Phase 1 uses monogram avatars
```

| Option | Type | Default | Notes |
|---|---|---|---|
| `group_by` | enum | `category` | `category` or `none` |
| `category` | string/int | — | Hard scope to one category |
| `show_add` | bool | `true` | Add-feed wizard button |
| `show_delete` | bool | `true` | Hide all destructive ops when false |
| `require_hold` | bool | `false` | Hold-to-confirm on delete (off by default — **D‑4**) |
| `show_feed_icons` | bool | — | **Phase 2** (needs `G6`); Phase 1 shows monogram avatars |
| `height` | string | `520px` | Scroll-area height |

**Operations** (all reachable per feed): **create** (via discovery wizard), **read** (all feed fields in the detail sheet), **update** (title, category/move, feed URL, disabled, crawler), **delete** (two-step confirm with a real entry count), **refresh**, **mark all read**, **enable/disable**.

**Add a feed:** tap **＋ Add feed**, paste a site or feed URL, pick from discovered candidates, choose a category (or create one inline), toggle the crawler, subscribe. Happy path is ≤3 interactions.

**Notes:** editing a feed's URL changes its source (a caution appears). Deleting a feed removes its entries — the confirm shows how many. Refresh-all can trigger a burst of updates; the button is debounce-guarded.

**Acceptance:** every feed operation the integration supports is reachable with zero gaps; delete needs ≥2 interactions and a real count; 500 feeds render and scroll smoothly.
