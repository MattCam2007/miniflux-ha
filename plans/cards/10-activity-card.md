# C9 — Activity Card (`custom:miniflux-activity-card`)

**Status:** High-level plan
**Depends on:** F (foundation)
**Role in suite:** the stress-test observer. A live, human-readable tail of everything the integration emits — the card you keep open while exercising the other eight, and afterwards the card power users keep for ambient awareness.

---

## Purpose

Show the integration's four HA event types as a rolling, timestamped feed, clearly distinguishing webhook-borne events from poll-derived ones, plus poll ticks and reachability transitions. This is Developer Tools → Events, purpose-built and readable.

## Integration surface used

| Kind | What | Why |
|---|---|---|
| Events | `miniflux_new_entries` | Row per delivery: feed title(s), entry count, capped-at-50 note when applicable (`EVENT_ENTRIES_CAP`) |
| Events | `miniflux_entry_saved` | Row: entry title + feed |
| Events | `miniflux_feed_error` / `miniflux_feed_recovered` | Rows badged as **poll-derived**, with error message / recovery |
| Entities | all 4 | State-change rows (poll ticks, count deltas, reachability flips) — and the *only* content for non-admin users (G4) |

No service calls at all — deliberately the one card that is pure listener, so it never adds load to what it observes.

## Layout (sketch)

```text
┌──────────────────────────────────────────────────┐
│ Activity                    [webhook|poll|all ▾] │
│ 12:04:31  ⚡ new_entries   Ars Technica · 3       │
│ 12:04:31  ⚡ new_entries   Lobsters · 1           │
│ 12:04:12  ⟲ poll          unread 142 → 146       │
│ 12:01:55  ⚡ entry_saved   "How GPS works"        │
│ 11:58:40  ⚠ feed_error    Broken Feed (poll)     │
│ 11:53:02  ✓ recovered     Flaky Feed (poll)      │
│ 11:52:48  ● reachable     off → on               │
│           … (ring buffer, newest first)          │
└──────────────────────────────────────────────────┘
```

## Behavior

- **Ring buffer**, default 100 rows, session-local only (HA events are fire-and-forget; there is no history backend, and this card does not pretend otherwise — a config note says the log starts when the dashboard opens).
- **Source badges:** ⚡ webhook-borne vs ⟲/⚠ poll-derived — teaching the STATUS.md distinction visually.
- **Filter dropdown** by source/type; pause button freezes the tail during inspection.
- **Row expand:** the raw event payload, pretty-printed — during stress tests this is the assertion surface (e.g., verifying the 50-entry event cap fires on a 200-entry webhook).
- **Burst grouping (S2):** ≥ 5 events in 2s collapse into an expandable "burst" row with a count — the storm stays legible.
- **Non-admin (G4/S9):** event rows unavailable; the card shows entity-transition rows only, with a one-line notice explaining why (this notice doubles as documentation of the HA allowlist limitation).

## Card configuration

```yaml
type: custom:miniflux-activity-card
buffer: 100
sources: [webhook, poll, entities]   # what to include
group_bursts: true
show_payloads: true                   # allow row expansion to raw payload
height: 360px
```

## States & edge cases

- **Payload content (S10):** entry titles inside payloads render as text nodes, clamped.
- **Reconnect:** WS resubscribe on connection loss; a divider row marks the gap ("connection lost 12:10–12:11 — events may be missing").
- **Two instances (S7):** rows tagged with instance name when more than one config entry is subscribed.

## Stress-test value

The instrument panel for every scenario in the overview's §5: S2's storm is *watched* here, C5's error/recovery loop is *verified* here, the webhook cap and payload shapes are *inspected* here. Building it early in spirit (it's last in build order only because it needs nothing from the others — it can be pulled forward if stress testing starts sooner) turns every manual test session into an observable one.

## Acceptance criteria

- A forced `refresh_all_feeds` burst renders grouped, in order, without dropping events (S2).
- A 200-entry webhook delivery's event row shows the 50-entry cap explicitly.
- Poll-derived vs webhook-borne badging matches STATUS.md's table exactly, for all four types.
- Non-admin users see entity-transition rows and the explanatory notice — never a blank card (S9).
