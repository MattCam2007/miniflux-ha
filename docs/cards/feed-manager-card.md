# Feed Manager Card

`custom:miniflux-feed-manager-card` — full feed CRUD from a Lovelace dashboard: add a feed (via discovery), edit, delete, refresh (one or all), mark as read, enable/disable. This is a **management surface only**: it never renders entry/article content.

This doc describes the card as it's actually implemented (`frontend/src/cards/feed-manager-card.ts`), not just as originally planned — where the two disagree, this is the real behavior.

## Before you start

- The Miniflux integration must already be installed and configured (**Settings → Devices & Services → Miniflux**) — see [`../setup.md`](../setup.md).
- If it isn't configured yet (no config entry), the card currently has no friendly "not set up" state — it fails to load with an error in the browser console rather than showing a helpful message. Set up the integration first.
- No manual setup for the card bundle itself on storage-mode dashboards — it's auto-registered. YAML-mode dashboards need the one-line resource add documented in [`../setup.md#lovelace-card-bundle`](../setup.md#lovelace-card-bundle).

## Add it to a dashboard

**Visual editor (recommended):** Edit dashboard → **+ Add card** → search "Miniflux" → **Miniflux Feed Manager**.

**YAML:**

```yaml
type: custom:miniflux-feed-manager-card
```

That's already a complete, valid config — every option below has a default, and the card auto-detects your Miniflux instance when exactly one is configured (the normal case).

## Configuration reference

| Option | Type | Default | In visual editor? | Notes |
|---|---|---|---|---|
| `group_by` | `category` \| `none` | `category` | Yes | `none` = flat list, no category headings |
| `category` | number or string | *(no scope)* | **No — YAML only** | Hard-scopes the *displayed list* to one category (id or exact title). Doesn't limit what the add-feed wizard's category picker offers. |
| `show_add` | boolean | `true` | Yes | Shows/hides the toolbar "＋ Add feed" button and the wizard entirely |
| `show_delete` | boolean | `true` | Yes | Hides only the 🗑 delete control per row — refresh/mark-read/edit/enable-disable stay |
| `require_hold` | boolean | `false` | Yes | `false` = tap to confirm delete; `true` = press-and-hold (~0.9s) |
| `height` | string (CSS length) | `520px` | **No — YAML only** | Scroll-area height of the feed list |
| `config_entry_id` | string | auto-detected | Only shown if you have >1 Miniflux instance | See [Multiple Miniflux instances](#multiple-miniflux-instances) |

`category` and `height` can only be set by editing the card's YAML directly (dashboard card's **⋮ → Edit in YAML**, or a YAML-mode dashboard) — they don't appear in the visual editor form at all.

### Example: read-only display, one category, taller list

```yaml
type: custom:miniflux-feed-manager-card
category: Tech
show_add: false
show_delete: false
height: 800px
```

### Example: flat list, hold-to-confirm delete

```yaml
type: custom:miniflux-feed-manager-card
group_by: none
require_hold: true
```

## Reading the feed list

Each row shows, left to right:

- A **monogram avatar** — the feed title's first letter, uppercased (`?` if the title is blank). Phase 1 has no real favicons.
- **Title**.
- **⏸** badge if the feed is disabled; the whole row also gets a dimmed/"silenced" style.
- **⚠** badge if the feed has parsing errors — hover it for the error message (shown as a tooltip).
- **Unread count** — from the last poll's snapshot, so it can lag Miniflux's live count by up to one polling interval.
- **Age** — time since the feed was last checked: "Just now", "`N`m ago", "`N`h ago", "`N`d ago", or "Never checked".

With `group_by: category` (default), feeds are grouped under their category name, groups sorted alphabetically, with an **Uncategorized** group always pinned last regardless of where it'd alphabetically fall. `group_by: none` drops grouping entirely — one flat list.

## Actions

### Add a feed

1. Click **＋ Add feed** in the toolbar.
2. Enter a **site URL or a direct feed URL**, then move focus out of the field (click elsewhere or Tab — a plain text-field `change`, not every keystroke) to trigger discovery.
   - If the URL ends in `.xml`, `.rss`, or `.atom` (optionally followed by `?...`), the card treats it as a direct feed URL and skips straight to step 3 — no discovery call is made.
   - Otherwise it runs Miniflux's feed discovery against that site and lists the candidates found (title + feed type).
3. Pick a candidate (for a direct URL, you're already here): choose a **category** from the picker, or use its inline **+ New category…** option to create one without leaving the wizard, and toggle **Use crawler** if needed.
4. Click **Subscribe**.

Errors (bad URL, unreachable site, duplicate feed) display verbatim inside the wizard, which stays open so you can correct and retry. On success the wizard closes and the new feed appears in the list — there's no separate success toast.

### Edit a feed

Click **✎** on a row. The edit sheet covers: **title**, **category** (same picker, with inline create), **feed URL**, **disabled**, and **crawler**. Changing the feed URL shows a caution note ("Changing the feed URL changes its source"), since it repoints the feed's source, not just its label.

Only the fields you actually changed are sent to the backend — with one exception: **Use crawler** is always sent, because Miniflux's `get_feeds` doesn't return the current crawler setting, so there's no baseline to diff against. **Save** applies changes and closes the sheet silently (no success toast); **Cancel** discards them.

A rename (title only, no category change) updates the row immediately, before the backend confirms — if the save then fails, the title reverts and a toast shows the error. A category move always waits for the server, since the category's display name is recomputed server-side.

### Refresh a feed

Click **⟳** on a row to refresh just that feed. It turns into **…** and disables. This can stay showing for a while: it clears once the *next poll* shows a new "checked" timestamp for that feed, not the instant you click, since the actual fetch happens server-side.

**⟳ Refresh all** in the toolbar does the same for every feed. It has no separate loading indicator of its own on the button.

### Mark a feed as read

Click **✓** on a row to mark every entry in that feed read. No confirmation step, no success toast — the unread count updates on the next refresh.

### Enable / disable a feed

Active feeds show a **Disable** button; disabled feeds show a prominent **Enable** button instead (plus the ⏸ badge and dimmed row). Toggling applies immediately (optimistically), with no confirmation step.

### Delete a feed

Click **🗑**. The panel that opens fetches the feed's *real, current* entry count and shows "Delete *X* and its *N* entries?" — if that count lookup itself fails, it falls back to showing 0 rather than hanging.

- Default (`require_hold: false`): click **Delete** to confirm.
- `require_hold: true`: the button reads **Delete (hold)** — press and hold for about a second; releasing early cancels with no partial effect.
- **Cancel** (or releasing a hold early) does nothing — no backend call is made either way.

Deletion has **no undo**. A successful delete just removes the row, silently (no toast); a failed one leaves the row in place and shows the backend's error in a toast.

## Errors and the offline banner

Every failed action shows the backend's error message verbatim in a toast at the bottom of the card, auto-dismissing after about 6 seconds. There's no retry button on the toast — repeat the action.

When `binary_sensor.miniflux_reachable` is `off`, a banner reads: "Miniflux is unreachable. Showing last-known data; actions are disabled." **Worth validating deliberately:** in the current build, that banner is informational only — nothing in the card actually disables the row/toolbar buttons when it's showing. Clicking them while unreachable just attempts the call and surfaces the resulting failure as a toast, rather than being blocked upfront.

## Data freshness

The feed list is cached for up to 5 minutes per view. It refreshes sooner than that when:

- any of the integration's 4 HA events fires (new entries, entry saved, feed error, feed recovered) — for admin users, picked up within ~2 seconds;
- the integration's own sensors tick on a poll — works for any user including non-admins (the fallback path), bounded by your configured polling interval (5 minutes by default);
- you make a successful change from *any* mounted Miniflux card, including this one — that invalidates and re-queries immediately.

Practical effect: a feed you add/edit/delete through this card reflects here right away. A change made directly in Miniflux's own web UI (or by another automation) can take up to one polling interval to show up here.

## Large feed lists (100+ feeds)

Past 100 feeds, the card switches to a virtualized (windowed) list for performance — and **`group_by: category` stops applying** at that point: you get one flat scrolling list with no category headings regardless of the `group_by` setting. This is current expected behavior rather than a bug, but it's worth deliberately checking if your instance has a large feed count.

## Multiple Miniflux instances

With exactly one Miniflux config entry (the normal case), the card auto-detects it and no instance picker appears anywhere. With more than one, the visual editor shows a **Miniflux instance** dropdown — note that as of this build it lists raw config-entry IDs, not friendly instance names. Pick one there, or set `config_entry_id` directly in YAML.

## Known Phase-1 limits

- No feed favicons — monogram avatars only.
- No entry/article content anywhere in this card; it's feed administration only.
- No tag support (matches the integration as a whole — see the main [README](../../README.md#known-limitations)).

## Validation checklist

- [ ] Card renders with zero config (`type: custom:miniflux-feed-manager-card` only); single instance auto-detected.
- [ ] `group_by: category` groups correctly; Uncategorized (if present) sorts last; `group_by: none` gives a flat list.
- [ ] `category: <id-or-title>` scopes the visible list to one category.
- [ ] A disabled feed shows ⏸ + dimmed row + **Enable** button; a feed with errors shows ⚠ with a tooltip message.
- [ ] Add feed: a direct feed URL (`.xml`/`.rss`/`.atom`) skips discovery; a site URL runs discovery and lists candidates; inline category creation works from the wizard.
- [ ] Add feed: a bad or duplicate URL shows an inline error and keeps the wizard open.
- [ ] Edit: rename-only feels instant (optimistic); category move waits on the server; a feed-URL change shows the caution note; only changed fields go out (except crawler, which always does).
- [ ] Refresh (single row and Refresh all) — confirm the row's pending-spinner behavior matches what's described above.
- [ ] Mark read and enable/disable both apply immediately with no confirmation dialog.
- [ ] Delete — the entry-count preview is accurate, `require_hold` behaves as configured (tap vs. hold), Cancel is a true no-op.
- [ ] `show_add: false` and `show_delete: false` each hide only what they claim to, nothing else.
- [ ] Stop/block Miniflux so `binary_sensor.miniflux_reachable` goes `off` — confirm the banner appears, and note whether the buttons are actually still clickable (see the callout above).
- [ ] If you have 100+ feeds: confirm virtualization kicks in and grouping drops out as described.
- [ ] If you have more than one Miniflux config entry: confirm the instance picker appears in the visual editor.
