# Miniflux Integration — Setup Guide

This guide wires a self-hosted [Miniflux](https://miniflux.app) instance to Home Assistant: API access for sensors and services, and Miniflux's native signed webhook for real-time `new entries` events. It ends with the conventions used by downstream "Unity" consumer scripts.

> **Design note:** signature verification for webhooks happens *inside* the integration. You never handle HMAC signatures in your automations — you consume clean `miniflux_new_entries` events, and anything that fails verification never reaches the event bus.

---

## Prerequisites

- A running Miniflux instance reachable **from Home Assistant** (for the API), with Home Assistant reachable **from Miniflux** (for the webhook — see [Choosing the webhook URL](#choosing-the-webhook-url)).
- A reasonably current Miniflux version (the integration's manifest documents the minimum supported version; the per-feed counters API and webhook events it relies on exist in all recent releases).
- Admin access to Miniflux settings.
- **If Miniflux and Home Assistant are both self-hosted on the same LAN** (the typical setup): Miniflux ≥ 2.2.18 blocks *outbound* webhook/integration requests to private-network addresses by default (SSRF protection), which otherwise silently breaks delivery to HA's LAN address. See the `INTEGRATION_ALLOW_PRIVATE_NETWORKS` note in [Choosing the webhook URL](#choosing-the-webhook-url).

## Part 1 — API access (sensors + services)

1. **In Miniflux:** *Settings → API Keys → Create a new API key*. Give it a recognizable description (e.g. `home-assistant`) and copy the key. Use a dedicated key — you can revoke it independently later.
2. **In Home Assistant:** *Settings → Devices & Services → Add Integration → Miniflux*, then enter:
   - **URL** — the full base URL of your instance, including any sub-path if you serve Miniflux under one (e.g. `https://reader.example.lan` or `https://home.example.lan/miniflux`).
   - **API key** — the key from step 1.
   - **Verify TLS certificate** — leave on unless you use a self-signed certificate you cannot add to HA's trust store.

   The integration validates the credentials immediately; a wrong URL or key fails the form with the reason.
3. You now have a Miniflux device with these entities:
   - `sensor.miniflux_unread_entries` — global unread count; per-category breakdown in the `by_category` attribute.
   - `sensor.miniflux_starred_entries` — starred count.
   - `sensor.miniflux_feeds_with_errors` — number of feeds with parsing errors; details (feed, error message, last check) in attributes.
   - `binary_sensor.miniflux_reachable` — API connectivity, with `last_success_at`, `last_error`, `last_webhook_at`, and server version attributes.

   Polling interval is configurable in the integration's **Options** (default 5 minutes).

### Lovelace card bundle

The integration ships a JS card bundle (`custom_components/miniflux/frontend/miniflux-cards.js`) for the dashboard cards it will add in later phases (feed manager, category manager, etc.).

- **Storage-mode dashboards (the default):** nothing to do — the integration auto-registers it as a Lovelace resource on setup, cache-busted per version. No manual "Add Resource" step, ever.
- **YAML-mode dashboards** (`lovelace: mode: yaml` in `configuration.yaml`): resources can't be added programmatically. Add this line yourself under `lovelace: resources:`:

  ```yaml
  lovelace:
    resources:
      - url: /miniflux/frontend/miniflux-cards.js?v=0.1.0
        type: module
  ```

  Bump the `?v=` query to the installed integration version after each upgrade so your browser doesn't serve a stale cached bundle.

## Part 2 — Webhook (real-time new-entry events)

The order below matters: Miniflux only generates the webhook secret **after** you save the URL, so this is a two-step round trip.

1. **In Home Assistant:** open the Miniflux integration → **Configure** → *Webhook*. Copy the displayed webhook URL. It looks like:

   ```text
   https://<your-ha-host>:8123/api/webhook/<long-random-id>
   ```

2. **In Miniflux:** *Settings → Integrations → Webhook*, paste that URL into **Webhook URL**, and save. Miniflux now displays a generated **Webhook secret** on the same page. Copy it.
3. **Back in Home Assistant:** paste the secret into the **Webhook secret** field of the same options step and save.

Until step 3 is done, deliveries are rejected with HTTP 401 **by design** (unverifiable payloads never become events), and a Repair issue in HA points you back to this step.

### Choosing the webhook URL

The URL must be reachable *from the Miniflux server*:

- **Same LAN (typical):** use HA's internal URL/host. Keep the webhook's **Local only** option (in the same options step) enabled — the endpoint then rejects requests from outside your local network.
- **Miniflux hosted remotely:** use your HA external URL or a Nabu Casa cloudhook, and disable **Local only**. Only expose the endpoint externally if you actually need to.

> **Both self-hosted on one LAN?** Miniflux ≥ 2.2.18 refuses to *send* outbound webhook/integration requests to private-network addresses by default — this is Miniflux's own SSRF protection, unrelated to HA's `Local only` option above (that one controls what HA *accepts*; this one controls what Miniflux is willing to *send to*). If Miniflux's logs show `connection to private network is blocked: host "..." resolves to a non-public IP address`, add `INTEGRATION_ALLOW_PRIVATE_NETWORKS=1` to **Miniflux's own** environment (e.g. the `environment:` block in its `docker-compose.yml`) and recreate the container — a plain restart won't pick up a new env var:
> ```bash
> docker compose up -d
> ```
> Without this, sensors still work fine (they only depend on HA polling Miniflux), but every webhook delivery fails silently from HA's point of view — nothing arrives, and Miniflux's own log is the only place the reason shows up.

### Verify the wiring

1. In Miniflux, open a feed that is likely to have new items and hit **Refresh** (or wait for its schedule).
2. In HA, *Developer Tools → Events*, listen to `miniflux_new_entries` — you should see an event when Miniflux finds new entries (no event fires if a refresh finds nothing new).
3. The `last_webhook_at` attribute on `binary_sensor.miniflux_reachable` updates on every verified delivery — it's the quickest "is delivery working at all" check.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Miniflux logs show `401` on webhook delivery; HA Repair issue about the secret | Secret missing or mismatched (e.g. webhook re-saved in Miniflux, which regenerates the secret) | Re-copy the secret from Miniflux into the integration options |
| No delivery at all (`last_webhook_at` never set, nothing in Miniflux logs either) | No new entries found, or webhook URL not saved in Miniflux | Refresh a feed with genuinely new items; re-check the URL |
| Delivery attempted but connection fails (Miniflux logs a network error) | HA not reachable from Miniflux, wrong host/port, or **Local only** blocking a non-local source | Fix the URL per [Choosing the webhook URL](#choosing-the-webhook-url) |
| Miniflux logs `connection to private network is blocked: host "..." resolves to a non-public IP address` | Miniflux ≥ 2.2.18's own SSRF protection refuses to send to private-network addresses — the common case when Miniflux and HA are both self-hosted on one LAN | Set `INTEGRATION_ALLOW_PRIVATE_NETWORKS=1` in **Miniflux's** environment and recreate its container (see [Choosing the webhook URL](#choosing-the-webhook-url)) |
| Events arrive but sensors lag | Sensors update via polling plus a short debounce after each webhook | Expected within ~10 s; lower the poll interval if you need faster steady-state |
| Everything worked, then entities became `unavailable` | Miniflux down or unreachable; check `binary_sensor.miniflux_reachable` attributes for the last error | Restore connectivity; the integration recovers on its own |
| HA badge asks to re-authenticate | API key revoked/expired | Enter a new key in the reauth dialog |

### Security notes

- The webhook secret is stored in the config entry (HA storage), not in your automations.
- Verified-only admission: payloads that fail HMAC verification are rejected with 401 and never emitted as events.
- The signature scheme carries no timestamp, so treat events as *advisory notifications*: have automations act on freshly queried state (`miniflux.get_entries`, `miniflux.search_entries`), not solely on event payload contents. The example below follows this pattern.
- Keep **Local only** enabled unless Miniflux is genuinely remote.

---

## Part 3 — Consuming it (Unity conventions)

### Events you can trigger on

| Event | When | Key payload fields |
|---|---|---|
| `miniflux_new_entries` | Miniflux found new entries in a feed | `feed` (id, title, category…), `entry_count`, `entries` (compact: id, title, url, published_at, author; capped at 50 with `truncated` flag) |
| `miniflux_entry_saved` | You hit **Save** on an entry in Miniflux — a manual "push this to the pipeline" gesture | `entry` (compact) |
| `miniflux_feed_error` | A feed started failing to parse | `feed`, `parsing_error_count`, `parsing_error_message` |
| `miniflux_feed_recovered` | A failing feed recovered | `feed` |

Event payloads never include article content — hydrate by ID when you need bodies.

### Example: reactive scoring automation (sketch)

```yaml
automation:
  - alias: "Unity: score new entries in Social candidates"
    trigger:
      - platform: event
        event_type: miniflux_new_entries
        event_data:
          feed:
            category_title: "Social candidates"
    action:
      - service: miniflux.get_entries
        data:
          entry_ids: "{{ trigger.event.data.entries | map(attribute='id') | list }}"
          include_content: true
        response_variable: hydrated
      # → ai_task.generate_data with your rubric over hydrated.entries
      # → rest_command to your n8n webhook for survivors
      - service: miniflux.update_entries
        data:
          entry_ids: "{{ hydrated.entries | map(attribute='id') | list }}"
          status: read
```

### Example: scheduled batch consumer (sketch)

```yaml
script:
  unity_morning_digest:
    sequence:
      - service: miniflux.count_entries
        data: &digest_filters
          category: "News"
          status: [unread]
          published_within: "36:00:00"
        response_variable: precheck
      - condition: "{{ precheck.total > 0 }}"
      - service: miniflux.search_entries
        data:
          <<: *digest_filters
          limit: 200
          include_content: true
        response_variable: batch
      # → chunk batch.entries, ai_task.generate_data per chunk, threshold/cluster
      # → POST survivors to n8n (envelope below)
      - service: miniflux.update_entries
        data:
          entry_ids: "{{ batch.entries | map(attribute='id') | list }}"
          status: read
      - event: unity_run_complete
        event_data:
          consumer: morning_digest
          scanned: "{{ batch.count }}"
```

Mark processed entries **by ID list** (as above), never with `miniflux.mark_all_read`, so entries arriving mid-run survive to the next one. `mark_all_read` is for humans declaring inbox bankruptcy.

### Handoff envelope to n8n (convention)

The integration doesn't talk to n8n; your script does. Recommended body, so all consumers look alike downstream:

```json
{
  "run_id": "morning_digest-2026-07-16T06:00Z",
  "consumer": "morning_digest",
  "generated_at": "2026-07-16T06:03:11Z",
  "source": {"categories": ["News"], "window_hours": 36},
  "stories": [
    {"entry_id": 12345, "url": "…", "title": "…", "score": 0.87, "rationale": "…", "cluster": "…"}
  ]
}
```

Validate `ai_task` structured output in the script (use its output-schema support) before POSTing; have n8n validate its input too. The `run_complete` event convention gives you one place to hang failure alerts: alert if a scheduled consumer *didn't* fire it.

### Useful service calls beyond the pipeline

- `miniflux.get_feeds` with `only_with_errors: true` — remediation dashboards/notifications with full error detail.
- `miniflux.refresh_feed` — kick a feed after fixing it; pair with `miniflux_feed_recovered` for closure.
- `miniflux.export_opml` on a schedule — nightly backup of your feed corpus (your feed list *is* this system's configuration).
