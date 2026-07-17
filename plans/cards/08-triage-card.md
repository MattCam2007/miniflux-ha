# C7 — Triage Card (`custom:miniflux-triage-card`)

**Status:** High-level plan
**Depends on:** F (foundation); shares atoms with C2
**Role in suite:** the fast-interaction card — one entry at a time, inbox-zero flow, keyboard/touch driven. Where C2 is for *reading*, C7 is for *deciding*.

---

## Purpose

Present the triage queue (default: unread, oldest first) one entry at a time with big, fast verdict actions: keep (star), done (read), toss (removed), skip. Optimized for a wall tablet (swipe) and a desktop dashboard (keyboard). The card that makes a 200-unread morning take four minutes.

## Integration surface used

| Kind | What | Why |
|---|---|---|
| Service | `search_entries` | The queue (configurable filter, prefetched in pages) |
| Service | `get_entries {include_content: true}` | Current + next entry prefetched for instant flips |
| Service | `update_entries` | Every verdict; fired per-entry, immediately (not batched at end — deliberate: sustained small-mutation load, the opposite traffic shape from C2's bulk ops) |
| Entity | `sensor.*_unread_entries` | Progress denominator |
| Events / entity ticks | Queue-refill signal when new entries arrive mid-session | |

## Layout (sketch)

```text
┌────────────────────────────────────────────┐
│ Triage — 12 of 142            [filter ▾]   │
│ ┌────────────────────────────────────────┐ │
│ │ How GPS actually works                 │ │
│ │ Ars Technica · 8 min read · 2h ago     │ │
│ │                                        │ │
│ │  (scrollable sanitized content)        │ │
│ └────────────────────────────────────────┘ │
│   [🗑 Toss]  [→ Skip]  [★ Keep]  [✓ Done]  │
│              ↶ Undo (5)                    │
└────────────────────────────────────────────┘
swipe: ← toss · → done · ↑ keep · ↓ skip
keys:  x · s(kip) · f(av) · space
```

## Interactions

| Verdict | Service call | Semantics |
|---|---|---|
| ✓ Done | `update_entries {status: read}` | Advance |
| ★ Keep | `update_entries {starred: true, status: read}` | Star + clear from queue (configurable: keep unread) |
| 🗑 Toss | `update_entries {status: removed}` | Advance |
| → Skip | No call | Moves entry to queue tail, session-local |
| ↶ Undo | Inverse `update_entries` restoring recorded prior `{status, starred}` | Stack depth ≥ 20; survives until card teardown |
| Open ↗ | `window.open(entry.url)` | Doesn't advance |

Queue mechanics: fetch `page_size` ids up front, hydrate current+next via `get_entries`, refill when 5 remain. New arrivals (event/tick) append with a subtle "+N new" note — never reshuffle the current position.

## Card configuration

```yaml
type: custom:miniflux-triage-card
filter: { status: [unread] }     # any search_entries filter
order: published_at
direction: asc                   # oldest-first triage by default
page_size: 25
keep_marks_read: true
enable_swipe: true
enable_keyboard: true
show_content: true               # false → title/summary only, faster flips
```

## States & edge cases

- **Queue exhausted:** celebration zero-state + "widen filter?" shortcut; progress header shows session tally (n done / kept / tossed).
- **Verdict fails (S3):** the card does **not** advance; toast with backend message; retry or skip explicitly. No silent divergence between UI position and server state.
- **Undo after the entry changed elsewhere (S4):** restore uses recorded prior state; if the row vanished (`missing` from `get_entries`), undo reports it instead of guessing.
- **Rapid-fire input (S8):** verdicts queue client-side FIFO; generation counter prevents a slow earlier call from clobbering a later one; input is never blocked on the network.
- **Mid-session feed deletion by C3:** hydration `missing` ids are skipped with a note.

## Stress-test value

The sustained-small-writes profile: one `update_entries` per human decision, several per second under rapid keyboard use — rate-of-fire the integration has never seen (pytest fires once; C2 batches). Also the sharpest optimistic-UI/undo correctness test, and a realistic webhook-mid-session interleaving scenario.

## Acceptance criteria

- 20 verdicts in 20 seconds: all land, order preserved, UI never blocks, final server state matches the session log exactly.
- Undo restores exact prior `{status, starred}` for any of the last 20 verdicts.
- A verdict during Miniflux downtime leaves the entry on screen with a visible failure (S3) — never a silently lost decision.
