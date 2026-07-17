# Backend Enabling Gaps — `G1`–`G8` as TDD units

> **Phase split (locked, `00-START-HERE.md`):** **`G2` and `G1` are PHASE 1** — build them now, they are prerequisites for C3 and C4 (`G1` is a hard requirement for C4). Their shapes are locked by **D‑6** (`G2`) and **D‑7** (`G1`) — build to those, not to any looser wording below. **`G3`, `G5`, `G6`, `G7`, `G8` are PHASE 2 (DEFERRED)** — do not build them during Phase 1. `G4` is a documented constraint, not a unit.

These are **integration-code** changes, built with the repo's existing pytest TDD process before the card/pipeline unit that needs them. `G1`–`G4` were surfaced in [`../00-overview.md §6`](../00-overview.md); `G5`–`G8` are surfaced by the *rich-content* goal — the integration currently drops the fields that make RSS content rich.

Ground truth (verified in code):
- `services.py::_entry_to_dict` serializes: `id, feed_id, feed_title, category_id, category_title, title, url, author, published_at, changed_at, status, starred, reading_time, tags` and `content` (only when `include_content`). **Nothing else.**
- `services.py::_feed_to_dict` serializes: `id, title, site_url, feed_url, category_id, category_title, checked_at, parsing_error_count, parsing_error_message, disabled`. **No icon.**
- `models.py::Entry` has no `enclosures`/`comments_url`; `models.py::Feed` has no `icon`.
- `services.yaml` search/get_entries expose `include_content` but **no `fetch_original`**, though `architecture.md §2.1/§3.3` designed it.

Seam rule for all of these: Miniflux JSON field names stay confined to `api.py` + `normalize.py`; models grow typed fields; `_*_to_dict` grows the serialization; `services.yaml`/`strings.json` grow any new selector. Same discipline as the shipped code.

---

## Rich-content enablers (build before the RC pipeline)

### `G5` — Entry enclosures (media: audio / video / image)
**Unblocks:** RC-U6 (media), RC-U5 (lead image/thumbnail), C2, C7.
**Why:** podcasts, video, and image attachments live in Miniflux's `entry.enclosures[]` (`{id, url, mime_type, size, media_progression}`). Dropping them makes "rich content" impossible — no player, no thumbnail.

**Changes**
- `models.py`: add `Enclosure(frozen)` = `id:int, url:str, mime_type:str, size:int, media_progression:int`; add `enclosures: tuple[Enclosure, ...] = ()` to `Entry`.
- `normalize.py::entry_from_json`: map `data.get("enclosures") or []` → tuple, defaulting each field (Miniflux omits `size`/`media_progression` sometimes).
- `services.py::_entry_to_dict`: serialize `enclosures` as a list of dicts **always** (they are small metadata, not content — they belong even when `include_content=false`, so a list row can show a 🎧/🎬/🖼 affordance without hydrating).
- `tests/fixtures/synthetic/`: add `entry_with_enclosures.json` (audio + image), extend `entry_full.json`.

**Tests**
- `normalize`: enclosure list mapped; missing `size`→0; missing `enclosures` key→`()`; non-list→`()`.
- `_entry_to_dict`: enclosures present with `include_content=false`; each dict has the 5 keys; empty entry → `enclosures: []`.
- `api`: `get_entries_by_id`/`search` fixtures carrying enclosures round-trip.

**DoD:** coverage floors hold; `entry_with_enclosures` fixture drives at least one search and one get_entries test.

---

### `G6` — Feed icon reference
**Unblocks:** RC-U7 (feed identity), C2 header, C3 rows, C5 rows.
**Why:** feed favicons are the cheapest, highest-impact "rich" signal in a list. Miniflux feed objects carry `icon: {feed_id, icon_id}` and serve bytes at `GET /v1/feeds/{id}/icon` (and `GET /v1/icons/{icon_id}`).

**Decision to make first (see Q3):** do we (a) expose only the icon *reference* and let the card fetch bytes via an authenticated proxy, or (b) add a small integration endpoint/service that returns the icon as a `data:` URI? Miniflux's icon endpoints require the API token, which the **frontend must never hold** — so a raw URL the browser fetches will 401. This gap is blocked on Q3.

**Changes (assuming resolution = integration returns data URI)**
- `models.py::Feed`: add `icon_id: int | None`.
- `normalize.py::feed_from_json`: map `data.get("icon", {}).get("icon_id")`.
- `_feed_to_dict`: serialize `icon_id`.
- New service `get_feed_icon {feed}` → `{data_uri}` (base64 `data:` of `image/*`), or fold icon bytes into a batched `get_icons {feed_ids:[...]}` to avoid N calls. **The card caches aggressively (icons rarely change).**

**Tests**
- `normalize`: icon_id mapped; missing icon → `None`.
- `api`: icon endpoint returns bytes+mime → data URI assembled; 404 → `None` not error.
- `services`: `get_feed_icon` unknown feed → validation error; known → `data:` prefix.

**DoD:** Q3 resolved and recorded; batched vs per-feed decided; coverage holds.

---

### `G7` — Readability full-text (`fetch_original`)
**Unblocks:** RC-U8 (full-text toggle), C2, C7.
**Why:** many feeds ship only a summary/teaser in `content`. `architecture.md §3.3` designed `fetch_original` on `search_entries`/`get_entries` (readability scrape via `GET /v1/entries/{id}/fetch-content`) but it was never added to `services.yaml`/`services.py`/`api.py`. Without it, "rich content" is often one paragraph and a "read more".

**Changes**
- `api.py`: add `fetch_original_content(entry_id) -> str` hitting `GET /v1/entries/{id}/fetch-content` (returns `{content}`); slow (hits origin site) → respect the 30s timeout, map errors normally.
- `services.py::get_entries`: add optional `fetch_original: bool = False`; when true, for each id, replace `content` with the readability fetch (bounded concurrency via the existing semaphore; a failed fetch falls back to feed content, not an error — record which ids fell back in a `fetched_original: [ids]` response field).
- `services.yaml`/`strings.json`: add `fetch_original` boolean selector to `get_entries` (and optionally `search_entries`, though per-entry-on-demand is the card's real path — see Q4).

**Tests**
- `api`: fetch-content success → content string; origin 5xx → mapped error.
- `services`: `get_entries fetch_original=true` swaps content; one id failing → falls back + appears in `fetched_original` correctly (or omitted); `include_content` interplay.
- Schema: `fetch_original` accepted, defaults false.

**DoD:** Q4 (search vs get-only) resolved; concurrency respected; coverage holds.

---

### `G8` — Entry `comments_url` (optional polish)
**Unblocks:** RC-U9 "discuss ↗" link (HN/Reddit/Lobsters).
**Why:** cheap, high-value for aggregator feeds. Miniflux entries carry `comments_url`.
**Changes:** `Entry.comments_url: str = ""`; map in `normalize`; serialize in `_entry_to_dict`. Fold into `G5`'s migration/fixtures to avoid a second fixture pass.
**Tests:** present/absent mapping; serialized. **DoD:** part of the `G5` change set.

---

## Previously-identified enablers (build before their card)

### `G1` — `get_categories` service — **PHASE 1, hard prerequisite for C4**
**Why:** empty categories are invisible today (only observable via feeds). Backend already hits `/v1/categories` at poll time.
**Locked (D‑7):** new service `get_categories` → `{categories:[{id, title, feed_count, unread}]}`. `feed_count`/`unread` are **joined from the coordinator snapshot** where available; unknown → **`null`** (never an error). The list **must include categories with zero feeds** — that is the entire reason `G1` exists.
**Changes:** `api.py::get_categories() -> list[Category]` (GET `/v1/categories`, optionally `?counts=true`); `models.py::Category(id, title, feed_count: int|None, unread: int|None)`; `normalize.py` maps it; new `get_categories` service handler joins snapshot counts and serializes. Miniflux JSON field names stay in `api.py`/`normalize.py`.
**Tests:** category with zero feeds present in the result; counts joined from snapshot; a category the snapshot lacks counts for → `feed_count/unread: null`, not an error; empty instance → `{categories: []}`; single-instance targeting resolves with no `config_entry_id`.
**DoD:** C4 can render an empty category; coverage floors hold.

### `G2` — per-feed unread counts in `get_feeds` — **PHASE 1, precedes C3**
**Why:** C3 wants an unread badge per feed without N× `count_entries`. The coordinator already fetches `/v1/feeds/counters` each poll; the data exists in the snapshot.
**Locked (D‑6):** `get_feeds` **joins the coordinator's polled snapshot** (`unread_by_feed`) — it does **not** issue a live counters fetch. The count is "as of last poll." A feed absent from the snapshot → **`unread: 0`** (never `null`, never an error).
**Changes:** `_feed_to_dict` adds `unread: int` from `snapshot.unread_by_feed.get(feed.id, 0)`. Thread the snapshot into the `get_feeds` service handler (it already has coordinator access). No `api.py`/`normalize.py` change (the field is derived, not from feed JSON).
**Tests:** feed present in `unread_by_feed` → that count; feed absent → `unread: 0`; `only_with_errors` still works and still carries `unread`; a feed the snapshot has but the live `get_feeds` doesn't (deleted between poll and call) simply isn't in the result.
**DoD:** C3 badge has a source; coverage floors hold.

### `G3` — `search_entries` offset — **optional, improves C2/C6**
**Why:** true pagination; removes the equal-timestamp cursor dedup wart (`../00-overview.md §3`). Miniflux supports `offset` natively.
**Changes:** `services.yaml`/`services.py` add optional `offset:int>=0`; `api.py` passes it through; `search_entries` response already returns `total` so callers know when more exists.
**Tests:** offset paginates; offset+limit bounds; offset beyond total → empty not error.
**DoD:** cursor pager (RC-adjacent, in C2) can switch to offset behind a capability check; coverage holds.

### `G4` — custom events are admin-only in the HA frontend — **not a build unit**
Not fixable here (HA core WS allowlist). Recorded as the reason the refresh design (F-U6/F-U7) mandates the entity-tick fallback for non-admin users, and documented in `docs/setup.md`. No code change.

---

## Sequencing summary

```
G5 (+G8)  →  G6  →  G7   ┐
                         ├─►  RC pipeline  →  C2, C7
G2  →  C3                │
G1  →  C4                │
G3  →  (C2/C6 pagination)┘
```

Every `G*` is a normal integration release increment: fixtures first, seam-confined field names, coverage floors green. None of them require the frontend to exist — they can land and ship independently, which is why they are first in the global build order.
