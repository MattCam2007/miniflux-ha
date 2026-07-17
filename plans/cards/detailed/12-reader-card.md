# C2 — Reader Card — Units & Usage

**High-level source:** [`../03-reader-card.md`](../03-reader-card.md). **The flagship** and the primary *rich RSS content* surface — a small RSS reader inside a dashboard tile.
**Depends on:** F (all), the entire **RC pipeline** (`RC-U1…U12`), and its backend enablers `G5/G6/G7`. Benefits from `G3` (offset) but ships with cursor pagination without it.

This is where the "rich content" goal is most visible, so its units lean on the RC pipeline rather than reinventing rendering.

---

## Units

### `C2-U1` — Card shell, view presets, toolbar
**Depends on:** F-U13, F-U4
**Deliverable:** `miniflux-reader-card` with view selector (Unread / Starred / All / History), header count, and toolbar.
**Behavior:** each preset is a canned `search_entries` filter; header count from `sensor.*_unread_entries` for first paint of the Unread scope; `show_toolbar`, `default_view`, hard `filter` scope from config.
**Tests:** each preset builds the correct filter; header count from entity on first paint; hard `filter` config merges with preset; toolbar hidden when configured.

### `C2-U2` — List query + virtualized rich rows
**Depends on:** C2-U1, F-U12, RC-U12, `G5`, `G6`
**Deliverable:** the entry list via `search_entries {include_content:false}` rendered as `<mf-entry-row>` in the virtualized list.
**Behavior:** rows show feed icon (`G6`), 2-line title, meta, lead thumbnail + media badge from enclosure metadata (`G5`, no content hydration); 10k unread paints <1s and scrolls smoothly (`S1`).
**Tests:** search maps filter→params; rows virtualized (bounded DOM); 🎧/🎬/🖼 badge from enclosures without hydration; thumbnail only when a lead image exists; empty view → preset-specific zero state.

### `C2-U3` — Row expand + rich content hydration
**Depends on:** C2-U2, RC-U11 (`<mf-entry-detail>`), F-U5
**Deliverable:** tap-to-expand hydrating via `get_entries {include_content:true}` into `<mf-entry-detail>`.
**Behavior:** metadata shows instantly from the row; body/media/readability fill in after hydration; hydration cached; `missing` id (stale cache) → row removed with a toast; `auto_mark_read_on_expand` (default on).
**Tests:** expand issues one `get_entries` for the id; detail upgrades from meta-only to full; second expand hits cache (no re-call); `missing` → row removed + toast; auto-mark-read fires `update_entries{status:read}` optimistically when enabled, not when disabled.

### `C2-U4` — Per-entry actions (optimistic)
**Depends on:** C2-U3, F-U8
**Deliverable:** star/unstar, read/unread, remove — single-row, optimistic with rollback.
**Behavior:** ★ → `update_entries{starred:toggle}`; read dot → `{status:read|unread}`; 🗑 → `{status:removed}` with a 5s undo toast restoring the exact prior status; all optimistic (`DC5`), rollback shows backend message.
**Tests:** star flips instantly, reverts + toast on failure; remove + undo restores exact prior `{status,starred}`; read toggle updates C1's count on next tick and instantly on the bus (`S4`).

### `C2-U5` — Filters, inline search, feed/category scoping
**Depends on:** C2-U1, F-U10
**Behavior:** `<mf-feed-picker>`/`<mf-category-picker>` scope the query; 🔍 inline text → `search:<q>` (debounced 400ms) on the current filter; `listen_bus` accepts filter pushes from C1 chips / C6 saved searches.
**Tests:** picker scopes the query; search debounces to one call; bus push updates the active filter and re-queries; clearing search restores the preset.

### `C2-U6` — Cursor pagination (+ optional `G3` offset)
**Depends on:** C2-U2, F-U5
**Behavior:** "Load more" paginates by `published_before` = oldest loaded ts, `direction:desc`, dedup on id (equal-timestamp wart, `../00-overview.md §3`); when `G3` capability present, switch to true `offset`.
**Tests:** page 2 requests with correct cursor; equal-timestamp duplicates deduped; end-of-data → no more button; with `G3`, uses offset and drops the dedup path.

### `C2-U7` — Live "N new entries" banner + event/tick refresh
**Depends on:** C2-U2, F-U7
**Behavior:** `miniflux_new_entries` (admin) or entity ticks (everyone) accumulate a "N new — refresh" banner; one re-query on tap regardless of burst size (`S2`); never auto-reshuffles under the user.
**Tests:** 3 events → banner "3 new"; tap → one re-query; non-admin gets banner within one poll of a burst (`S9`); banner never appears mid-scroll without user action.

### `C2-U8` — Multi-select bulk actions
**Depends on:** C2-U4, F-U5
**Behavior:** long-press/checkbox mode → bulk star/read/remove; exercises `UPDATE_IDS_MAX` (500) chunking; ⋮ → "Mark view read" uses `mark_all_read` scoped to a single feed/category filter, else bulk `update_entries` over loaded ids (confirm when scope > loaded).
**Tests:** 600 selected → 2 `update_entries` calls; mark-view-read uses scope service for single-feed filter, falls back for compound; confirm shown when scope exceeds loaded rows.

### `C2-U9` — Offline, nasty content, cross-card sync (roll-up hardening)
**Depends on:** C2-U3, RC-U1
**Behavior:** offline (`DC7`) → list retained, actions disabled, banner explains; all content via the RC sanitizer (`S10`); a C7/C3 mutation updates this list via the store without a re-query (`S4`).
**Tests:** offline disables actions, keeps list; XSS corpus entry renders inert; external mutation reflected without re-query; stale response never overwrites newer (`S8`, via F-U5 generations).

---

## Usage — `custom:miniflux-reader-card`

Browse, read, and act on entries — a rich reader tile. Renders sanitized article bodies, inline images, podcast/video players, feed icons, and full-text on demand.

```yaml
type: custom:miniflux-reader-card
default_view: unread           # unread | starred | all | history
filter:                        # optional hard scope (e.g. a "Tech news" card)
  category: Tech
page_size: 50                  # 1..500
height: 480px                  # scroll-area height; omit = grow with content
show_toolbar: true
auto_mark_read_on_expand: true

# --- rich content controls (RC pipeline) ---
show_images: true              # load remote images in article bodies (privacy toggle)
show_media: true               # audio/video players + enclosure list
autoplay_media: false          # never true by default
readability: on_demand         # off | on_demand | always  (full-text via fetch_original, G7)
gallery: true                  # in-card lightbox for multi-image entries
embeds: click_to_load          # off | click_to_load  (allowlisted hosts only — see Q2)
show_feed_icons: true          # feed favicons (G6)

listen_bus: true               # accept filter pushes from C1 chips / C6 saved searches
```

| Option | Type | Default | Notes |
|---|---|---|---|
| `default_view` | enum | `unread` | Preset filter |
| `filter` | map | — | Hard scope merged with the preset (any `search_entries` field) |
| `page_size` | int | `50` | 1–500; page size for list + "Load more" |
| `height` | string | grow | Scroll-area height |
| `show_toolbar` | bool | `true` | View selector + filters + search |
| `auto_mark_read_on_expand` | bool | `true` | Mark read when a row is expanded |
| `show_images` | bool | `true` | Remote images in content (off = privacy, tap to reveal) |
| `show_media` | bool | `true` | Render enclosure players/attachments |
| `autoplay_media` | bool | `false` | Players always `preload=none`; autoplay opt-in only |
| `readability` | enum | `on_demand` | Full-text fetch behavior (needs `G7`) |
| `gallery` | bool | `true` | Lightbox for image-heavy entries |
| `embeds` | enum | `click_to_load` | Sandboxed, allowlisted-host embeds only |
| `show_feed_icons` | bool | `true` | Feed favicons (needs `G6`) |
| `listen_bus` | bool | `true` | Accept cross-card filter pushes |

**Reading & acting**
- Tap a row to expand: metadata appears instantly, the article body + media hydrate a moment later, and (for teaser feeds) a **"Read full article"** control fetches readability text.
- **★** star, **read dot** toggle read/unread, **🗑** remove (with 5-second undo). All apply instantly and roll back with the server's message if the call fails.
- **Multi-select** (long-press or checkbox mode) for bulk star/read/remove; **⋮ → Mark view read** marks the whole active scope.
- **Open ↗** opens the original article in a new tab; the dashboard never navigates away.

**Rich media**
- Podcast entries get an inline audio player that **remembers your position** per episode.
- Video entries show a click-to-load poster; image-heavy entries a gallery lightbox.
- Turn off `show_images`/`show_media` for a lean, text-only, low-bandwidth reader.

**Live & offline**
- A "N new entries — refresh" banner appears on new activity; tapping it refreshes once (bursts never storm the server). Non-admin users update on the coordinator poll tick.
- When Miniflux is offline, the list stays visible, actions disable, and a banner explains.

**Acceptance:** 10k-unread instance paints <1s and scrolls smoothly; expand→read→collapse updates C1's count within a tick (instantly on the bus); remove+undo restores exact prior status; rich content (images/audio/video/full-text) renders sanitized and theme-aware.
