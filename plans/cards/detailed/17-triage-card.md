# C7 — Triage Card — Units & Usage

> **🟡 PHASE 2 — DEFERRED.** Depends on the deferred RC pipeline. Not part of minimum-bar Phase 1 (decision **D‑1**, [`00-START-HERE.md`](./00-START-HERE.md)). Do not build during Phase 1.

**High-level source:** [`../08-triage-card.md`](../08-triage-card.md). The fast-interaction card — one entry at a time, inbox-zero flow, keyboard/touch driven. Where C2 is for *reading*, C7 is for *deciding*.
**Depends on:** F (all), RC pipeline (`RC-U11` content, `RC-U6` media), shares atoms with C2. The sustained-small-writes stress profile.

---

## Units

### `C7-U1` — Queue engine (prefetch, hydrate, refill)
**Depends on:** F-U5, F-U4
**Behavior:** fetch `page_size` ids up front via `search_entries` (configurable filter, `order`/`direction` — default oldest-first); hydrate current + next via `get_entries {include_content:true}` for instant flips; refill when 5 remain; new arrivals (event/tick) append with "+N new" and **never reshuffle** the current position.
**Tests:** initial queue fetched; current+next hydrated (2 ahead); refill triggers at threshold; new arrivals append at tail, current index unchanged; `missing` ids skipped with a note.

### `C7-U2` — Single-entry rich view
**Depends on:** C7-U1, RC-U11
**Behavior:** renders the current entry via `<mf-entry-detail>` (feed badge, meta, sanitized body, media, readability toggle); `show_content:false` → title/summary only for faster flips.
**Tests:** current entry rendered rich; `show_content:false` renders header-only; media player present for enclosure entries; content sanitized.

### `C7-U3` — Verdict actions (per-entry, immediate)
**Depends on:** C7-U2, F-U8
**Behavior:** Done `update_entries{status:read}`; Keep `{starred:true,status:read}` (or keep-unread per `keep_marks_read`); Toss `{status:removed}`; Skip (no call, session-local tail move); each fired **immediately** (not batched — deliberate sustained load); advance on success only; failure (`S3`) does **not** advance — toast + explicit retry/skip.
**Tests:** each verdict fires the right call and advances; skip makes no call and re-queues; failure keeps the entry on-screen with a message; keep-unread variant omits `status:read`.

### `C7-U4` — Undo stack
**Depends on:** C7-U3
**Behavior:** inverse `update_entries` restoring recorded prior `{status,starred}`; depth ≥20; survives to teardown; undo after the row changed elsewhere (`S4`) uses recorded prior state; if the row vanished (`missing`), undo reports it rather than guessing.
**Tests:** undo restores exact prior state for any of last 20; undo on a since-deleted entry reports instead of erroring; stack depth cap.

### `C7-U5` — Input: keyboard + swipe + rapid-fire safety
**Depends on:** C7-U3
**Behavior:** keys `x`=toss, `s`=skip, `f`=keep, `space`=done, `u`=undo (config-gated `enable_keyboard`); swipe ←toss →done ↑keep ↓skip (`enable_swipe`, honor `prefers-reduced-motion`); verdicts queue client-side FIFO with a generation counter so a slow earlier call never clobbers a later one; input never blocks on the network (`S8`); keyboard handlers don't hijack keys while another control is focused.
**Tests:** each key → its verdict; swipe directions map correctly; 20 verdicts in 20s all land in order, UI never blocks, final server state matches the session log; generation counter drops a stale earlier response; reduced-motion disables animation.

### `C7-U6` — Queue states + progress
**Depends on:** C7-U1
**Behavior:** progress header "12 of 142" (denominator from `sensor.*_unread_entries`), session tally (done/kept/tossed); exhausted → celebration zero-state + "widen filter?"; offline verdict leaves the entry visible with a failure (never a silently lost decision).
**Tests:** progress + tally update; exhausted zero-state; offline verdict visible failure.

---

## Usage — `custom:miniflux-triage-card`

One entry at a time with big, fast verdicts — a 200-unread morning in four minutes. Great on a wall tablet (swipe) and a desktop dashboard (keyboard).

```yaml
type: custom:miniflux-triage-card
filter: { status: [unread] }     # any search_entries filter
order: published_at
direction: asc                   # oldest-first triage by default
page_size: 25
keep_marks_read: true            # Keep also marks read (false = star but keep unread)
enable_swipe: true
enable_keyboard: true
show_content: true               # false → title/summary only, faster flips
show_media: true                 # audio/video players in the entry view
```

| Option | Type | Default | Notes |
|---|---|---|---|
| `filter` | map | `{status:[unread]}` | Any `search_entries` filter — defines the queue |
| `order` / `direction` | enum | `published_at` / `asc` | Oldest-first by default |
| `page_size` | int | `25` | Prefetch depth |
| `keep_marks_read` | bool | `true` | Keep = star (+read, unless false) |
| `enable_swipe` / `enable_keyboard` | bool | `true` | Input modes |
| `show_content` | bool | `true` | Full rich content vs header-only |
| `show_media` | bool | `true` | Render enclosure players |

**Verdicts:** **✓ Done** (read), **★ Keep** (star), **🗑 Toss** (removed), **→ Skip** (defer, session-local). **↶ Undo** restores the last 20 verdicts exactly. **Keyboard:** `space` done · `f` keep · `x` toss · `s` skip · `u` undo. **Swipe:** ← toss · → done · ↑ keep · ↓ skip.

**Notes:** verdicts apply immediately and the card advances only when the server confirms; a failed verdict (e.g. Miniflux offline) leaves the entry on screen with an error — never a silently lost decision. New entries arriving mid-session are appended, never shuffled under you.

**Acceptance:** 20 verdicts in 20 seconds all land in order with the UI never blocking and final server state matching the session log; undo restores exact prior state; a verdict during downtime shows a visible failure.
