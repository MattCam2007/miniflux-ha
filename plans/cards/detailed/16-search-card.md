# C6 — Search Card — Units & Usage

> **🟡 PHASE 2 — DEFERRED.** Not part of minimum-bar Phase 1 (decision **D‑1**, [`00-START-HERE.md`](./00-START-HERE.md)). Do not build during Phase 1.

**High-level source:** [`../07-search-card.md`](../07-search-card.md). The parameter-sweep card (`S6`): every field `search_entries`/`count_entries` accept is a visible, combinable control. If a filter parameter has a bug, this card finds it.
**Depends on:** F (all), pickers (F-U10), RC pipeline for row expansion (RC-U11/U12). Benefits from `G3` (offset).

---

## Units

### `C6-U1` — Filter form (every field) + live count
**Depends on:** F-U4, F-U10
**Behavior:** controls for `search`, `status[]` (incl. `removed`), `starred` tri-state (yes/no/omitted — omitted ≠ false), `category`/`feed` (by title or id per `refs_as`), published mode switch (`published_within` **xor** `published_after`/`before`), `order`, `direction`, `limit` (1–500), `include_content`; live `count_entries` preview debounced 600ms.
**Tests:** each control maps to the right param; starred tri-state omits vs sets; published modes mutually exclusive in UI; count preview debounces; `refs_as` emits title vs id.

### `C6-U2` — Run search + results + bulk actions
**Depends on:** C6-U1, F-U12, RC-U12, F-U5
**Behavior:** explicit **Run** → `search_entries` (not per keystroke); virtualized results with `<mf-entry-row>` + expand via shared `<mf-entry-detail>`; bulk "★ all results" / "✓ mark results read" via `update_entries` chunked at 500; the only card that shows `removed` entries and can un-remove them (closing C2's 🗑 loop).
**Tests:** Run issues one search with all set fields (`S6` — every field at once renders); results virtualized; bulk over result ids chunked at 500; removed entries visible and un-removable; count-preview vs returned `total` mismatch logged visibly.

### `C6-U3` — Saved searches + bus + date-range proving
**Depends on:** C6-U1
**Behavior:** named filter presets in card config, run with one tap, pushable to a co-located C2 via the bus; the after/before date pair (R1's one never-live-tested filter) is exercised here — its results must be correct against the live instance; invalid combos (after>before) are sent anyway and surface the backend's validation text verbatim.
**Tests:** saved chip runs its filter; push emits bus payload; date-range produces correctly filtered results (fixture); after>before → backend error verbatim, card doesn't pre-block.

---

## Usage — `custom:miniflux-search-card`

A full query builder over your entries: text search plus every structured filter, a live match count, results, and reusable saved searches.

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

| Option | Type | Default | Notes |
|---|---|---|---|
| `saved_searches` | list | `[]` | `{name, filter}`; `filter` is any `search_entries` field set |
| `default_expanded` | bool | `false` | Filter panel open on load |
| `refs_as` | enum | `title` | Send category/feed as `title` or `id` |

**Filters:** text `search` (Miniflux syntax passed through), `status` (unread/read/**removed**), `starred` (any/yes/no), `category`, `feed`, published (**within** a duration *or* **after/before** dates — mutually exclusive), `order`, `direction`, `limit` (1–500), `include content`.

**Notes:** the **~count** preview is a cheap dry-run that updates as you edit; results load only on **Run**. Invalid filter combinations are sent as-is so Miniflux's own validation message is what you see. This is the one card that can *see* removed entries and put them back. Saved searches can be pushed to a reader card with one tap.

**Acceptance:** a single Run can emit a `search_entries` call with **every** optional field at once and render; count preview and returned `total` agree (or the discrepancy is shown); date-range mode returns correctly filtered results.
