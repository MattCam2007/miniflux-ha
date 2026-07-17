# C5 — Health Card (`custom:miniflux-health-card`)

**Status:** High-level plan
**Depends on:** F (foundation)
**Role in suite:** makes the integration's whole *observability* story visible — broken feeds, reachability, and the two poll-derived events (`miniflux_feed_error` / `miniflux_feed_recovered`) that nothing else in the suite displays as first-class content.

---

## Purpose

A dedicated "is anything wrong?" card. The status card (C1) shows *that* there are errors; this card shows *which* feeds, *why*, *since when*, and offers the fix actions (retry now, disable, jump to edit).

## Integration surface used

| Kind | What | Why |
|---|---|---|
| Entity | `sensor.*_feeds_with_errors` + `feeds`/`truncated`/`total_feeds` attrs | First paint (capped at 25) |
| Entity | `binary_sensor.*_reachable` | Connection section |
| Service | `get_feeds {only_with_errors: true}` | Authoritative, uncapped error list (DC3) — the only card driving this parameter |
| Service | `refresh_feed` | "Retry now" per row |
| Service | `update_feed {disabled: true}` | "Silence" a permanently dead feed |
| Events | `miniflux_feed_error` / `miniflux_feed_recovered` | Live row add/clear + a session-local recovery log (admin; entity-tick fallback otherwise) |

## Layout (sketch)

```text
┌──────────────────────────────────────────────────┐
│ Health                     ● Miniflux reachable  │
│                                                  │
│ ⚠ 2 of 63 feeds failing                          │
│ ┌──────────────────────────────────────────────┐ │
│ │ Broken Feed        ×14   last ok 3d ago      │ │
│ │ "unable to parse feed: unexpected token…"    │ │
│ │              [⟳ Retry] [⏸ Disable] [✎ Edit]  │ │
│ ├──────────────────────────────────────────────┤ │
│ │ Flaky Feed          ×2   checked 10m ago     │ │
│ └──────────────────────────────────────────────┘ │
│ Recently recovered: Ars Technica (12:04) ✓       │
└──────────────────────────────────────────────────┘
```

All-healthy state collapses to a single green line — this card is meant to be boring most of the time.

## Interactions

| Control | Action | Notes |
|---|---|---|
| ⟳ Retry | `refresh_feed {feed: id}` | Row pends until next poll tick updates `parsing_error_count`/`checked_at`; a `miniflux_feed_recovered` event clears it live |
| ⏸ Disable | `update_feed {feed: id, disabled: true}` | Confirm ("stops fetching, keeps entries"); row moves to a collapsed "silenced" section |
| ✎ Edit | Bus hop to a co-located C3 edit sheet, or navigate to configured path | The usual fix is a changed `feed_url` — that edit lives in C3 |
| Recovery log entry | Dismissible; session-local only (no backend history exists) | |

## Card configuration

```yaml
type: custom:miniflux-health-card
hide_when_healthy: false     # true → card renders nothing when 0 errors & reachable
show_recovered: true         # session-local recovery log
show_disabled: true          # the "silenced" section
error_message_lines: 3       # clamp long parser errors; tap to expand
```

## States & edge cases

- **Attribute cap (S1):** > 25 error feeds → attribute first paint shows 25 + `truncated: true` → the `get_feeds {only_with_errors}` query replaces it with the real list and a count reconciliation.
- **Miniflux itself down (DC7/S3):** the per-feed section greys out (data is stale by definition) and the reachability line becomes the headline. Retry buttons disabled.
- **Error message content (S10):** parser messages are untrusted text — rendered as text nodes, clamped, expandable.
- **Flapping feed (S2):** error → recovered → error within one debounce window must settle on the latest state, not interleave.

## Stress-test value

The only card that consumes the transitions machinery (`transitions.py` → `miniflux_feed_error`/`recovered`) as its primary content, closing the loop on the integration's poll-diff eventing. Also the natural harness for a deliberate stress scenario: point a test feed at a 500-ing URL, watch error appear; fix it, watch recovery — end-to-end through coordinator, event bus, and UI.

## Acceptance criteria

- A feed forced into error state appears here within one poll interval with its real `parsing_error_message`; fixing it produces a visible recovery (event-driven live for admins, next-tick otherwise).
- Retry, disable, and edit paths all reachable per failing feed.
- With 30+ broken feeds, the card shows the true total and full list, visibly noting the sensor attribute was truncated (S1).
