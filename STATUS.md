# STATUS

**Last updated:** 2026-07-16
**One-line summary:** code-complete, fully tested, wire-contract confirmed against a live instance — not yet installed in a real Home Assistant, not yet merged to `main`, not yet released.

This file is the single place to check "where are we, exactly." If it disagrees with README.md or docs/, this file wins — it's the ground truth snapshot.

---

## What this IS

- A **Home Assistant custom integration** for a self-hosted **Miniflux** RSS/Atom reader, installed via **HACS as a custom repository**.
- A **plumbing layer**: it polls Miniflux, verifies and reacts to Miniflux's native webhook, and exposes that as HA-native primitives —
  - **4 entities:** `sensor.miniflux_unread_entries`, `sensor.miniflux_starred_entries`, `sensor.miniflux_feeds_with_errors`, `binary_sensor.miniflux_reachable`.
  - **17 services:** query (`search_entries`, `count_entries`, `get_entries`, `get_feeds`), mutation (`update_entries`, `mark_all_read`), and admin (feed/category CRUD, `refresh_feed`/`refresh_all_feeds`, `discover_feeds`, `export_opml`/`import_opml`).
  - **4 HA event types it can fire:** `miniflux_new_entries`, `miniflux_entry_saved`, `miniflux_feed_error`, `miniflux_feed_recovered` — see the webhook section below, only the first two of these come from Miniflux itself.
  - **2 self-clearing Repair issues** for webhook wiring problems, and a **redacted diagnostics dump** for bug reports.
- Meant to sit **underneath** a separate orchestration layer (n8n or anything else that can call an HA service) that the user builds themselves. This integration makes zero decisions about what to do with the data.
- Built with strict TDD across 8 phases. **448 tests passing**, every module at 100% branch coverage except one pre-existing, accepted 99% branch in `api.py`. Every wire-contract assumption (auth header, endpoint shapes, field names, webhook headers, **and the webhook signature scheme itself**) has been checked against a real, live Miniflux **2.3.2** instance — not just guessed. See `plans/decisions-and-assumed-contract.md` for the full reconciliation record.

## What this is NOT

- **Not an AI pipeline, rubric engine, or content generator.** It has no opinions about scoring, prompts, or scheduling beyond its own polling interval. That's the deliberate design (see `docs/architecture.md` D5) — a separate consumer owns all of that.
- **Not a tag manager, and never will be.** Stock Miniflux has no API to write tags, so none exists here. This was explicitly closed as a permanent decision, not a "not yet."
- **Not responsible for Miniflux ↔ Home Assistant network reachability.** If your Miniflux server can't reach your HA instance (or vice versa), that's environment/network configuration on your end, not something this integration manages.
- **Not replay-protected on webhook deliveries.** Miniflux signs webhooks with a timestamp-less HMAC, so a captured delivery could technically be replayed. Mitigated (webhook defaults to LAN-only, events are meant to be treated as advisory triggers — act on freshly queried state, not solely on event contents), not eliminated. This is a known, documented, shipped trade-off.
- **Not in the HACS default store.** It only installs via HACS's "custom repository" (add-repo) flow — it will not show up if you just search HACS for "Miniflux" without adding the repo URL first.
- **Not brand-registered with Home Assistant.** No logo in `home-assistant/brands` yet, so HACS/hassfest will show a cosmetic "brand missing" warning and HA will show a generic icon instead of a Miniflux logo. Doesn't block install or function.
- **Not yet released.** No GitHub Release/tag exists. `manifest.json` is at `0.1.0` and ready, but cutting the tag was deliberately left as your call, not done automatically.
- **Not yet run inside a real Home Assistant instance.** Every test — all 448 of them — runs against `pytest-homeassistant-custom-component`'s simulated HA test harness. That harness is high-fidelity (it exercises real HA config-entry machinery, the real webhook component, the real issue registry), but it is still a simulation. This integration has never actually loaded inside a genuine running Home Assistant.
- **Not multi-language.** `strings.json`/`translations/` ship English only.

---

## Webhook event types — confirmed: exactly 2, from Miniflux

**Yes — Miniflux sends exactly two native webhook event types, and that's the complete set. Confirmed three independent ways, not assumed:**

1. **Live capture** against the user's own real instance (`plans/r1-contract-pinning.md` Section B): two, and only two, event types were ever delivered — `new_entries` and `save_entry` — via the `X-Miniflux-Event-Type` header.
2. **Miniflux's own documentation** (miniflux.app/docs/webhooks.html): describes exactly these two events and no others.
3. **Miniflux's own source** (the `webhook` package): defines exactly two event-type constants — `NewEntriesEventType = "new_entries"` and `SaveEntryEventType = "save_entry"` — nothing else exists to send.

The integration's code matches this exactly: `webhook_payload.parse_and_project()` handles only these two `event_type` values; anything else is rejected as a 400 (verified-but-unrecognized), never silently ignored.

**Important distinction — don't conflate this with the 4 HA event types above:**

| HA event this integration fires | Where it actually comes from |
|---|---|
| `miniflux_new_entries` | A real Miniflux **webhook** delivery (1 of the 2 above) |
| `miniflux_entry_saved` | A real Miniflux **webhook** delivery (the other of the 2 above) |
| `miniflux_feed_error` | **Not a webhook at all** — computed locally by the coordinator diffing two consecutive polls (a feed's error count going from 0 to >0) |
| `miniflux_feed_recovered` | **Not a webhook at all** — same mechanism, in reverse |

So: 2 inbound webhook types from Miniflux, 4 outbound HA event types total — the other 2 are this integration's own invention from polling, not anything Miniflux sends.

---

## What's left before installing via HACS (Add Repository)

Nothing code-blocking. What remains is process/deployment, roughly in order:

1. **Merge the work to `main`.** Everything above lives on the `claude/ha-miniflux-architecture-du0t8n` branch (PR #1). A standard HACS "Add custom repository" install reads from the repo's default branch (or a tagged release) — it doesn't have a normal path to install an arbitrary non-default branch. This needs to land on `main` first.
2. **Decide: install from `main` HEAD, or cut a tagged release (`v0.1.0`) first.** Both work with a HACS custom repository; a tag is the cleaner, more conventional path and everything is prepped for it (`manifest.json` already at `0.1.0`) — it just hasn't been cut yet, on purpose, pending your go-ahead.
3. **Confirm CI is actually green on GitHub.** Locally, the full suite passes, coverage floors are met, and lint is clean — but the real `hassfest` and `HACS` validation actions (`.github/workflows/validate.yml`) run only on GitHub itself, and their actual pass/fail result on this branch hasn't been directly observed in this conversation.
4. **The mechanical HACS steps** (already written up in `README.md`): HACS → Integrations → ⋮ → Custom repositories → add this repo's URL, category *Integration* → find **Miniflux** → Install → restart HA.
5. **Add the integration for real:** Settings → Devices & Services → Add Integration → Miniflux → enter your URL + API key. This is the first time `config_flow.py` runs outside a test harness.
6. **The two-phase webhook handshake** (documented in `docs/setup.md` Part 2): copy the URL HA shows you into Miniflux's webhook settings, save, copy the secret Miniflux generates back into HA's options, save.
7. **Re-confirm `INTEGRATION_ALLOW_PRIVATE_NETWORKS=1`** is still set on the Miniflux container. You already added this earlier to unblock the R1 webhook capture — it's also the exact thing that makes delivery to your *real* HA instance possible, since HA is just as much a private-network address as the capture box was. Worth a deliberate double-check now that it matters for real, not just for testing.
8. **The actual first live end-to-end smoke test.** Force a feed refresh in Miniflux, watch for `miniflux_new_entries` in HA's Developer Tools → Events, confirm all 4 entities show sane values. This is the moment that closes the "never run inside real HA" gap above.

Optional, non-blocking follow-ups: submit a logo to `home-assistant/brands` (cosmetic only), and revisit `published_after`/`published_before` param names if a date-range filter service call ever behaves unexpectedly (the one item R1 never directly exercised — very low risk, would fail loudly if wrong).
