# Dashboard Card Plans

High-level plans for a suite of Lovelace dashboard cards for the Miniflux integration, derived from the shipped integration surface (see [`../../STATUS.md`](../../STATUS.md): 4 entities, 17 services, 4 HA event types).

**Start with [`00-overview.md`](./00-overview.md)** — it fixes the delivery mechanism, the shared frontend runtime, the data-access patterns every card uses, the service/event coverage matrix, and the integration gaps this planning pass exposed. Then read the card plans in any order; build them in the listed order.

| # | Doc | Card | One-liner |
|---|---|---|---|
| — | [`00-overview.md`](./00-overview.md) | — | Architecture, decisions, coverage matrix, stress-test doctrine, build order |
| F | [`01-foundation.md`](./01-foundation.md) | — | Shared runtime: bundle, delivery, service-call helper, event bus, cache, editors |
| C1 | [`02-status-card.md`](./02-status-card.md) | `miniflux-status-card` | At-a-glance totals + reachability + global quick actions |
| C2 | [`03-reader-card.md`](./03-reader-card.md) | `miniflux-reader-card` | The flagship: browse entries, read content, act on each entry |
| C3 | [`04-feed-manager-card.md`](./04-feed-manager-card.md) | `miniflux-feed-manager-card` | Every feed operation: list, add (discover), edit, refresh, delete |
| C4 | [`05-category-manager-card.md`](./05-category-manager-card.md) | `miniflux-category-manager-card` | Every category operation: list, create, rename, delete, mark read |
| C5 | [`06-health-card.md`](./06-health-card.md) | `miniflux-health-card` | Broken feeds, error detail, retry, recovery tracking |
| C6 | [`07-search-card.md`](./07-search-card.md) | `miniflux-search-card` | Full query builder — every filter parameter the API supports |
| C7 | [`08-triage-card.md`](./08-triage-card.md) | `miniflux-triage-card` | One-entry-at-a-time inbox-zero flow with undo |
| C8 | [`09-opml-card.md`](./09-opml-card.md) | `miniflux-opml-card` | OPML backup (export/download) and restore (import) |
| C9 | [`10-activity-card.md`](./10-activity-card.md) | `miniflux-activity-card` | Live tail of the 4 `miniflux_*` events — the stress-test observer |

These are **high-level plans**: each fixes the card's purpose, the exact integration surface it consumes, its layout, interactions, configuration, edge cases, and acceptance criteria. Per-card TDD chunking (in the style of [`../00-overview.md`](../00-overview.md)) is deliberately deferred until a card is picked up for implementation.
