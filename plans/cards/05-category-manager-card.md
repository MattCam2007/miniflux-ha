# C4 — Category Manager Card (`custom:miniflux-category-manager-card`)

**Status:** High-level plan
**Depends on:** F (foundation); **G1 (`get_categories` service) is a hard prerequisite** — without it, empty categories are invisible and the card cannot honestly claim "see all categories"
**Role in suite:** the "see and do **all** operations on a category" card — the second half of the minimum bar.

---

## Purpose

Complete category administration: see every category (including empty ones) with counts, create, rename, delete, and act on a category's contents (mark read, drill into feeds/entries).

## Integration surface used

| Kind | What | Why |
|---|---|---|
| Service | `get_categories` (**G1**, new) | The list — id, title, feed_count, unread |
| Service | `create_category` | ＋ New category |
| Service | `update_category` | Inline rename |
| Service | `delete_category` | Delete flow (two-step, S5) |
| Service | `mark_all_read {category}` | Row action, with `count_entries` preview |
| Service | `get_feeds {category}` | Expanded row: the category's feeds (read-only here; management lives in C3) |
| Service | `count_entries {category, status:[unread]}` | Blast-radius previews |
| Entity | `sensor.*_unread_entries` `by_category` attr | First-paint counts before the service responds; reconciled against G1 data |

## Layout (sketch)

```text
┌──────────────────────────────────────────────┐
│ Categories (7)              [＋ New category] │
│ Tech        24 feeds   87 unread    ✎ ✓ 🗑    │
│ News        18 feeds   40 unread    ✎ ✓ 🗑    │
│ ▾ Comics     3 feeds   15 unread    ✎ ✓ 🗑    │
│     · xkcd · SMBC · PhD Comics    → feeds ↗  │
│ Empty Cat    0 feeds    0 unread    ✎ ✓ 🗑    │  ← only visible because of G1
└──────────────────────────────────────────────┘
✎ rename · ✓ mark read · 🗑 delete
```

## Interactions

| Control | Action | Notes |
|---|---|---|
| ＋ New category | Name prompt → `create_category` | Duplicate-title error surfaces verbatim |
| ✎ Rename | Inline edit → `update_category {category, title}` | Optimistic label, rollback on error |
| ✓ Mark read | `<mf-confirm>` w/ `count_entries` preview → `mark_all_read {category}` | |
| 🗑 Delete | `<mf-confirm>`: "Delete *Comics* — its **3 feeds and their entries** go with it?" (Miniflux deletes contained feeds) → `delete_category` | The most destructive single call in the suite; `require_hold` honored |
| Row expand | `get_feeds {category}` sub-list; tap-through link to a C3/C2 view | |
| Unread count tap | Push category filter to a co-located C2 reader via the local bus | |

## Card configuration

```yaml
type: custom:miniflux-category-manager-card
show_empty: true
show_delete: true
require_hold: true          # default ON here — deleting a category nukes its feeds
sort: unread                # unread | title | feeds
```

## States & edge cases

- **Empty category:** fully manageable — the exact case G1 exists for.
- **Delete cascade (S4):** invalidates feed cache, category cache, and entry queries in one bus event; C2/C3 cards on the same view drop the dead rows on re-query.
- **Rename collision with a concurrent rename elsewhere:** last write wins server-side; re-query reconciles — no local merge logic.
- **`by_category` cap (S1):** first paint may miss categories beyond 100; the G1 query is authoritative and replaces it (DC3).

## Stress-test value

Exercises the full category CRUD path (previously only touched by pytest), the cascade-delete concurrency scenario, and G1 itself — a brand-new backend service getting its first real client. `mark_all_read {category}` from here plus `{feed}` from C3 plus `{everything}` from C1 completes all three scopes of that service (coverage matrix).

## Acceptance criteria

- Every operation the integration supports on a category is reachable: create, read (incl. empty ones), rename, delete, mark-read. **Zero gaps.**
- Delete shows feed count in the confirm and requires hold (default config) (S5).
- An empty category created here is immediately pickable as a target in C3's add-feed wizard (shared `<mf-category-picker>` cache invalidation).
