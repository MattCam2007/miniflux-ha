# C5 — Health Card — Units & Usage

**High-level source:** [`../06-health-card.md`](../06-health-card.md). Makes the integration's observability story visible — broken feeds, reachability, and the two poll-derived events (`miniflux_feed_error`/`miniflux_feed_recovered`) nothing else displays as first-class content.
**Depends on:** F (all); feed badge (RC-U7) optional.

---

## Units

### `C5-U1` — Error list: attribute first paint → authoritative query
**Depends on:** F-U6, F-U11
**Behavior:** first paint from `sensor.*_feeds_with_errors` + `feeds`/`truncated`/`total_feeds` (cap 25); then `get_feeds {only_with_errors:true}` (the only card driving this parameter) replaces it with the uncapped list + a `<mf-truncation-notice>` reconciliation; all-healthy → single green line; `hide_when_healthy` option.
**Tests:** >25 errors → 25 + truncated note, then full list from query; reconciliation count correct; all-healthy collapses; `hide_when_healthy:true` renders nothing when clean+reachable.

### `C5-U2` — Per-feed error detail + fix actions
**Depends on:** C5-U1, F-U9
**Behavior:** each row shows `parsing_error_count`, clamped `parsing_error_message` (`error_message_lines`, tap to expand — rendered as **text**, `S10`), `checked_at`; ⟳ Retry `refresh_feed` (pends until poll updates count/`checked_at`); ⏸ Disable `update_feed {disabled:true}` (confirm "stops fetching, keeps entries", row → collapsed "silenced" section); ✎ Edit bus-hops to a C3 edit sheet or navigates.
**Tests:** error message rendered as text and clamped/expandable; retry calls `refresh_feed`, pends, clears on recovery; disable confirms then moves row; edit emits bus/nav.

### `C5-U3` — Live error/recovery + reachability
**Depends on:** C5-U1, F-U7
**Behavior:** `miniflux_feed_error`/`_recovered` (admin) add/clear rows live and drive a session-local recovery log (`show_recovered`); entity-tick fallback otherwise; reachability line becomes the headline when Miniflux itself is down (`DC7/S3`) and retry buttons disable; flapping feed (`S2`) settles on the latest state within the debounce window.
**Tests:** error event adds a row; recovered event clears it + logs recovery; non-admin gets the change on next tick; Miniflux-down greys the per-feed section + disables retries; flap settles on latest.

---

## Usage — `custom:miniflux-health-card`

A dedicated "is anything wrong?" card — which feeds are failing, why, since when, and the fix actions. Boring (a green line) most of the time.

```yaml
type: custom:miniflux-health-card
hide_when_healthy: false     # true → render nothing when 0 errors & reachable
show_recovered: true         # session-local recovery log
show_disabled: true          # the "silenced" section
error_message_lines: 3       # clamp long parser errors; tap to expand
```

| Option | Type | Default | Notes |
|---|---|---|---|
| `hide_when_healthy` | bool | `false` | Fully hide when clean + reachable |
| `show_recovered` | bool | `true` | Session-local recovery log (no backend history exists) |
| `show_disabled` | bool | `true` | Collapsed "silenced" section |
| `error_message_lines` | int | `3` | Clamp parser errors; tap to expand |

**Per failing feed:** **⟳ Retry** (`refresh_feed`), **⏸ Disable** (stops fetching, keeps entries), **✎ Edit** (usually the fix is a changed feed URL — that edit lives in C3).

**Notes:** the error list first paints from the sensor attribute (capped at 25) and is then replaced by the full, uncapped list; if there were more than 25, the card says so. When Miniflux itself is unreachable, the per-feed data is stale by definition — the card greys it and makes reachability the headline. Recovery history is session-local (HA events are fire-and-forget; there is no history backend).

**Acceptance:** a feed forced into error appears within one poll with its real message; fixing it produces a visible recovery (live for admins, next-tick otherwise); 30+ broken feeds show the true total and full list with a truncation note.
