# Miniflux for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
![Minimum HA version](https://img.shields.io/badge/Home%20Assistant-2025.6.0%2B-41BDF5.svg)
[![Test](https://github.com/MattCam2007/miniflux-ha/actions/workflows/test.yml/badge.svg)](https://github.com/MattCam2007/miniflux-ha/actions/workflows/test.yml)

A Home Assistant custom integration that wraps a self-hosted [Miniflux](https://miniflux.app) RSS/Atom reader instance: a **reading and scoring layer** for content pipelines. It polls and reacts to Miniflux over its native webhook, exposes health/inventory sensors, and gives your automations and scripts a full set of query/mutation/admin services — so a tool like n8n (or anything else that can call an HA service) can search, hydrate, and act on your feeds without ever touching the Miniflux API directly.

This integration owns transport, auth, pagination, caps, normalization, and failure surfacing. It does not own orchestration: no rubrics, no scheduling beyond its own polling, no opinions about what your pipeline does with the data. See [`docs/architecture.md`](docs/architecture.md) for the full design and [`docs/setup.md`](docs/setup.md) for the user-facing setup and troubleshooting guide.

## Requirements

- A running, reachable Miniflux instance and an API key for it (Miniflux → Settings → API Keys). Network reachability between Miniflux and Home Assistant is on you — this integration doesn't set up tunnels, proxies, or DNS.
- Home Assistant **2025.6.0** or newer.

## Installation (HACS custom repository)

This integration is not in the default HACS list. Add it as a custom repository:

1. In HA, open **HACS → Integrations**.
2. Click the **⋮** menu (top right) → **Custom repositories**.
3. Add `https://github.com/MattCam2007/miniflux-ha`, category **Integration**.
4. Find **Miniflux** in HACS and install it.
5. Restart Home Assistant.
6. **Settings → Devices & Services → Add Integration → Miniflux**, and enter your server URL and API key.

## Webhook setup (real-time events)

Sensors work immediately from polling alone. The webhook is what gets new-entry events to you in near-real-time instead of waiting for the next poll. It's a two-step round trip because **Miniflux only generates the webhook secret after you save the URL**:

1. In HA: **Configure → Webhook** on this integration, copy the displayed URL.
2. In Miniflux: **Settings → Integrations → Webhook**, paste the URL, save, copy the secret Miniflux generates.
3. Back in HA: paste that secret into the same **Webhook** options step, save.

Until step 3 is done, deliveries are rejected with HTTP 401 by design (unverifiable payloads never become events), and a Repair issue points you back here. Full walkthrough, URL-choice guidance for remote Miniflux instances, and a troubleshooting table: [`docs/setup.md`](docs/setup.md#part-2--webhook-real-time-new-entry-events).

## Entities

| Entity | What it reports |
|---|---|
| `sensor.miniflux_unread_entries` | Global unread count, with a per-category breakdown in the `by_category` attribute |
| `sensor.miniflux_starred_entries` | Starred count (the queryable engagement signal) |
| `sensor.miniflux_feeds_with_errors` | Count of feeds currently failing to parse, with per-feed detail in attributes |
| `binary_sensor.miniflux_reachable` | Connectivity — deliberately stays available and truthful (never goes `unavailable`) even when Miniflux is down, so it can report the outage instead of vanishing into it |

## Events

| Event | Fires when |
|---|---|
| `miniflux_new_entries` | A verified webhook delivery reports new entries for a feed |
| `miniflux_entry_saved` | You hit "save" on an entry in Miniflux — a manual push-to-pipeline gesture |
| `miniflux_feed_error` | A poll detects a feed newly failing to parse |
| `miniflux_feed_recovered` | A poll detects a previously-failing feed recovering |

Event payloads are compact projections (no article body, capped entry lists) — call the `get_entries` service with the ids from an event to hydrate full content. See [`docs/architecture.md` §3.5](docs/architecture.md#35-ha-event-vocabulary-outbound-public-contract) for exact payload shapes.

## Services

| Service | Purpose |
|---|---|
| `miniflux.search_entries` | Query entries by category/feed/status/starred/search/date range, paginated internally |
| `miniflux.count_entries` | Cheap pre-flight count with the same filter contract |
| `miniflux.get_entries` | Hydrate specific entries by id (the event-to-content bridge) |
| `miniflux.get_feeds` | List feeds, optionally filtered by category or parsing errors |
| `miniflux.get_categories` | List every category, including empty ones (feed_count/unread as of last poll) |
| `miniflux.update_entries` | Declarative status/starred update over an explicit id list |
| `miniflux.mark_all_read` | Mark a whole feed/category/instance as read (the human "inbox zero" action) |
| `miniflux.create_feed` / `update_feed` / `delete_feed` | Feed management |
| `miniflux.refresh_feed` / `refresh_all_feeds` | Force a fetch outside the feed's own schedule |
| `miniflux.discover_feeds` | Probe a site URL for candidate feeds without subscribing |
| `miniflux.create_category` / `update_category` / `delete_category` | Category management |
| `miniflux.export_opml` / `import_opml` | Back up or bulk-load your feed list |

Every service validates its input before making any HTTP call and fails loudly (a bad filter or an unreachable server surfaces as a real error in the calling script's trace, never a silent empty result). Full field reference is in each service's description in the HA UI (Developer Tools → Actions), sourced from `services.yaml`/`strings.json`.

## Dashboard cards

The integration ships two Lovelace cards, auto-registered on setup (no manual resource step on storage-mode dashboards — see [`docs/setup.md`](docs/setup.md#lovelace-card-bundle)):

| Card | Type | Does |
|---|---|---|
| Feed Manager | `custom:miniflux-feed-manager-card` | Full feed CRUD: add via discovery, edit, delete, refresh, mark-read, enable/disable |
| Category Manager | `custom:miniflux-category-manager-card` | Full category CRUD including empty categories, cascade-aware delete, mark-read |

Both are zero-config (single-instance auto-detected) and management surfaces only — no entry/article content is rendered by either card. Frontend source lives in the isolated [`frontend/`](frontend/) subtree; see [`frontend/README.md`](frontend/README.md) for its own build/test commands.

## Known limitations

- **No tag support.** Stock Miniflux has no API to write tags, so this integration doesn't expose one — and won't grow one via workarounds. The full engagement surface stock Miniflux supports is read state, starred, and the save-entry event, and that's what this integration carries end to end.
- **Webhook deliveries are not replay-protected.** Miniflux signs webhooks with a plain HMAC and no timestamp/nonce, so a captured delivery could in principle be replayed. Mitigations: the webhook defaults to **Local only** (LAN-reachable), and events should be treated as advisory triggers — have automations act on freshly queried state (`get_entries`/`search_entries`), not solely on event payload contents.
- **Wire contract pinned against one Miniflux version.** Some details (header names, a couple of field names) were pinned against the maintainer's own instance rather than every historical Miniflux release. If you hit a parsing/verification error on an unusual version, please open an issue with your Miniflux version.

## Diagnostics & troubleshooting

Download diagnostics from the integration's device page for a redacted dump (API key, webhook secret, and webhook id are never included) covering coordinator health, webhook wiring status, and feed/unread counts — useful to attach to a bug report. Two Repair issues (`webhook_secret_missing`, `webhook_signature_failing`) surface webhook wiring problems in the HA UI directly, and self-clear once fixed. See [`docs/setup.md`](docs/setup.md#troubleshooting) for the full troubleshooting table.

## Brand icon

This integration doesn't yet have an icon in [`home-assistant/brands`](https://github.com/home-assistant/brands) — HACS/hassfest show a brand-missing warning until one is submitted there in a follow-up PR. This doesn't block custom-repository install; it only affects whether HA shows a Miniflux logo instead of a generic icon.

## License

MIT — see [`LICENSE`](LICENSE).
