# C6 — Search Card (`custom:miniflux-search-card`)

**Status:** High-level plan
**Depends on:** F (foundation)
**Role in suite:** the parameter-sweep card (stress scenario S6). Every field `search_entries`/`count_entries` accept is a visible, combinable control here. If a filter parameter has a bug, this card finds it.

---

## Purpose

A full query builder over the entry corpus: text search plus every structured filter, with a live result count, a result list, and reusable saved searches. Doubles as the human-friendly face of the integration's most complex service schema.

## Integration surface used

| Kind | What | Why |
|---|---|---|
| Service | `count_entries` | Live count preview as the filter form changes (debounced) — cheap dry-run before fetching rows |
| Service | `search_entries` | The results, on explicit Run (not per keystroke) |
| Service | `get_entries` | Row expansion (shared `<mf-entry-row>`/`<mf-content-view>` from C2) |
| Service | `update_entries` | Bulk actions on the result set ("star all results", "mark results read") |

## Layout (sketch)

```text
┌──────────────────────────────────────────────────────┐
│ 🔍 [ text search…                    ]  ~ 37 matches │
│ Filters ▾                                            │
│  status: [unread ✓] [read ✓] [removed ]              │
│  starred: (any|yes|no)   category: [Tech ▾]          │
│  feed: [— ▾]             published: (within 7d ▾ /   │
│                            after [date] before [date])│
│  order: [published_at ▾]  direction: (desc|asc)      │
│  limit: [100]  include content: [ ]                  │
│                     [Run search]  [★ Save search]    │
│ ── results (37) ──────────────── [✓ all] [★ all] ──  │
│  entry rows … (virtualized, cursor pagination)       │
└──────────────────────────────────────────────────────┘
Saved: [unread this week] [starred in Tech] [long reads]
```

## Interactions

| Control | Maps to | Notes |
|---|---|---|
| Text field | `search` | Miniflux full-text syntax passed through untouched |
| Status checkboxes | `status: [...]` (multi) | Exercises the multi-select list schema incl. `removed` |
| Starred tri-state | `starred: true/false/omitted` | Omitted ≠ false — the tri-state exists to test exactly that |
| Category/feed pickers | `category` / `feed` | By title *or* id (a config toggle sends the raw title string, exercising the backend's title→id resolution both ways) |
| Published mode switch | `published_within` (duration) **or** `published_after`/`before` (datetimes) | Mutually exclusive modes in the UI; the after/before pair is the one filter R1 never exercised live — this card is its designated proving ground |
| Order/direction/limit | `order`, `direction`, `limit` (1–500) | `order` offers Miniflux's documented sort fields |
| Include content | `include_content` | On = deliberately heavy responses (S8 payload testing) |
| ~ count | `count_entries` with the same filter, debounced 600ms | Mismatch between preview count and fetched `total` is itself a signal worth logging |
| Save search | Named filter preset stored in card config (edited via UI editor) | Saved chips run with one tap; can be pushed to a C2 reader via the bus |
| Bulk row actions | `update_entries` over result ids | Chunked at 500 |

## Card configuration

```yaml
type: custom:miniflux-search-card
saved_searches:
  - name: unread this week
    filter: { status: [unread], published_within: { days: 7 } }
  - name: long reads
    filter: { search: "", order: reading_time, direction: desc, limit: 20 }
default_expanded: false      # filter panel collapsed until tapped
refs_as: title               # title | id — how pickers emit category/feed refs
```

## States & edge cases

- **Invalid combinations** (e.g. `published_after` > `published_before`): sent anyway on Run — surfacing the backend's validation text verbatim is part of the point; the card never pre-blocks what the schema allows.
- **Zero results:** count preview already said ~0; zero state offers "clear filters".
- **`removed` status visible:** the only card that lets users *see* removed entries (and un-remove them via bulk status change) — closing the loop on C2's 🗑 action.
- **Huge result + content on (S8/S10):** 500 entries with full content is the largest payload the integration can emit; must render (virtualized) without freezing the dashboard.

## Stress-test value

The designated S6 card: every schema field drivable, in combination, including both ref styles (title vs id), the never-live-tested date-range params (R1's one residual), tri-state booleans, and maximum-payload responses. During soak testing, its saved searches are the repeatable query fixtures.

## Acceptance criteria

- A single Run can emit a `search_entries` call containing **every** optional field simultaneously, and the result renders (S6).
- Count preview and `search_entries`'s returned `total` agree for the same filter (or the discrepancy is logged visibly).
- Date-range mode produces correctly filtered results against the live instance — formally closing R1's `published_after`/`published_before` residual.
