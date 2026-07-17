# C4 — Category Manager Card — Units & Usage

> **🟢 PHASE 1 — BUILD NOW.** The second minimum-bar card ([`00-START-HERE.md`](./00-START-HERE.md), decision **D‑1**). **Baked decisions:** `require_hold` default **true** (category delete cascades → hold-to-confirm, **D‑4**); category list + counts from **`G1`** with empty categories included (**D‑7**); single instance, zero-config (**D‑3**). **`G1` is a hard prerequisite — build it (step 4) before this card.**

**High-level source:** [`../05-category-manager-card.md`](../05-category-manager-card.md). The second half of the minimum bar — every operation on a category.
**Depends on:** F (foundation atoms C4 uses), `<mf-confirm>` incl. the hold variant (F-U9), the category picker (F-U10); **`G1` (`get_categories`) is a hard prerequisite** — without it, empty categories are invisible and the card cannot honestly claim "see all categories."

---

## Units

### `C4-U1` — Category list (incl. empty) with counts
**Depends on:** F-U13, `G1`
**Behavior:** `get_categories` (`G1`) → id, title, feed_count, unread; `by_category` attribute for instant first paint, reconciled/replaced by the authoritative `G1` query (`DC3`); `show_empty`, `sort: unread|title|feeds`.
**Tests:** empty category rendered (the case `G1` exists for); first paint from attribute then replaced by `G1`; sort orders; counts shown.

### `C4-U2` — Create / rename
**Depends on:** C4-U1, F-U8
**Behavior:** ＋ New → name prompt → `create_category` (duplicate-title error verbatim); ✎ inline rename → `update_category`, optimistic label + rollback.
**Tests:** create then appears; duplicate → verbatim error; rename optimistic + rollback; new empty category immediately pickable in C3's wizard (shared picker cache invalidation).

### `C4-U3` — Mark-read + delete (cascade-aware)
**Depends on:** C4-U1, F-U9
**Behavior:** ✓ `<mf-confirm>` with `count_entries {category,status:[unread]}` preview → `mark_all_read {category}`; 🗑 `<mf-confirm>` "Delete *Comics* — its **N feeds and their entries** go with it?" → `delete_category` (Miniflux deletes contained feeds — the most destructive single call in the suite); `require_hold` defaults **on** here.
**Tests:** mark-read preview count real; delete confirm shows feed count and requires hold by default; cancel → no call.

### `C4-U4` — Row expand + cascade concurrency
**Depends on:** C4-U1, F-U7
**Behavior:** expand → `get_feeds {category}` read-only sub-list with tap-through to C3/C2; unread-count tap pushes a category filter to a co-located C2 via the bus; delete cascade (`S4`) invalidates feed + category + entry caches in one bus event.
**Tests:** expand lists the category's feeds; count tap emits bus filter; delete emits combined invalidation; C2/C3 drop dead rows on re-query.

---

## Usage — `custom:miniflux-category-manager-card`

Complete category administration, including **empty** categories (which the sensor attributes can't show).

```yaml
type: custom:miniflux-category-manager-card
show_empty: true
show_delete: true
require_hold: true          # default ON — deleting a category also deletes its feeds
sort: unread                # unread | title | feeds
```

| Option | Type | Default | Notes |
|---|---|---|---|
| `show_empty` | bool | `true` | Show 0-feed categories (needs `G1`) |
| `show_delete` | bool | `true` | Hide delete when false |
| `require_hold` | bool | `true` | Hold-to-confirm; **on by default** (cascade delete) |
| `sort` | enum | `unread` | `unread` \| `title` \| `feeds` |

**Operations** (all reachable per category): **create**, **read** (including empty ones), **rename**, **delete**, **mark all read**, plus **drill-in** to a category's feeds.

**⚠ Delete cascades:** deleting a category in Miniflux also deletes the feeds inside it and their entries. The confirm states this and shows the feed count; hold-to-confirm is on by default.

**Acceptance:** every category operation is reachable with zero gaps, including managing empty categories; delete shows the feed count and requires hold; an empty category created here is immediately usable as a target in C3's add-feed wizard.
