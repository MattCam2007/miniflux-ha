# C9 — Activity Card — Units & Usage

> **🟡 PHASE 2 — DEFERRED.** Not part of minimum-bar Phase 1 (decision **D‑1**, [`00-START-HERE.md`](./00-START-HERE.md)). Do not build during Phase 1.

**High-level source:** [`../10-activity-card.md`](../10-activity-card.md). The stress-test observer — a live, readable tail of everything the integration emits. Pure listener: **no service calls**, so it never adds load to what it observes.
**Depends on:** F (all), especially the refresh bus subscriptions (F-U7).

---

## Units

### `C9-U1` — Event tail + ring buffer + source badges
**Depends on:** F-U7
**Behavior:** subscribes to the 4 `miniflux_*` events (admin) and the 4 entities; ring buffer (`buffer`, default 100, newest first, session-local); source badges ⚡ webhook-borne vs ⟲/⚠ poll-derived (teaching STATUS.md's distinction); rows: `new_entries` (feed titles + count + capped-at-50 note when `EVENT_ENTRIES_CAP` hit), `entry_saved` (title+feed), `feed_error`/`recovered` (badged poll-derived, with message), entity state-changes (poll ticks, count deltas, reachability flips).
**Tests:** each event type → a correctly-shaped, correctly-badged row; buffer caps at `buffer` (oldest dropped); 200-entry `new_entries` shows the 50-cap note; poll-vs-webhook badging matches STATUS.md for all four types.

### `C9-U2` — Filter, pause, row-expand payloads
**Depends on:** C9-U1
**Behavior:** filter dropdown by source/type; pause freezes the tail for inspection; row expand → pretty-printed raw payload (the stress-test assertion surface, `S10` payload titles as text); `show_payloads` gate.
**Tests:** filter hides non-matching rows; pause stops new rows appending (buffered, resume flushes); expand shows raw payload as text; `show_payloads:false` disables expansion.

### `C9-U3` — Burst grouping, reconnect, non-admin, multi-instance
**Depends on:** C9-U1
**Behavior:** ≥5 events in 2s collapse into an expandable "burst (N)" row (`S2`); WS reconnect draws a "connection lost HH:MM–HH:MM — events may be missing" divider; non-admin (`G4/S9`) → entity-transition rows only + a one-line notice explaining the HA allowlist (the notice doubles as documentation); multi-instance (`S7`) tags rows with the instance name.
**Tests:** burst collapses with a count and expands; reconnect inserts a gap divider; non-admin shows entity rows + notice, never blank; two instances → instance-tagged rows.

---

## Usage — `custom:miniflux-activity-card`

A live, human-readable tail of the four `miniflux_*` events plus poll ticks and reachability changes — Developer Tools → Events, purpose-built and readable. Keep it open while using the other cards; keep it for ambient awareness afterwards.

```yaml
type: custom:miniflux-activity-card
buffer: 100
sources: [webhook, poll, entities]   # what to include
group_bursts: true
show_payloads: true                   # allow row expansion to raw payload
height: 360px
```

| Option | Type | Default | Notes |
|---|---|---|---|
| `buffer` | int | `100` | Ring-buffer size (session-local) |
| `sources` | list | all | `webhook` \| `poll` \| `entities` |
| `group_bursts` | bool | `true` | Collapse ≥5 events/2s into one row |
| `show_payloads` | bool | `true` | Expand a row to its raw payload |
| `height` | string | `360px` | Scroll-area height |

**Notes:** rows are badged ⚡ (webhook-borne: `new_entries`, `entry_saved`) vs ⟲/⚠ (poll-derived: `feed_error`, `feed_recovered`) — matching STATUS.md exactly. The log is **session-local** and starts when the dashboard opens (HA events are fire-and-forget; there is no history backend). **Non-admin users** see only entity-transition rows plus a short notice — Home Assistant restricts custom-event subscriptions to admins (`G4`). Multi-instance setups tag each row with the instance.

**Acceptance:** a forced `refresh_all_feeds` burst renders grouped, in order, without dropping events; a 200-entry `new_entries` shows the 50-cap explicitly; poll-vs-webhook badging matches STATUS.md; non-admin users see entity rows + the notice, never a blank card.
