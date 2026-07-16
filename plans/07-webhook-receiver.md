# Phase 6 — Webhook Receiver & Repairs

**Goal:** terminate Miniflux's native signed webhook inside the integration. Verify the HMAC **before parsing anything**, re-emit a clean typed HA event, nudge the coordinator, and never let an unsigned payload reach the bus. Automation authors consume `miniflux_new_entries` / `miniflux_entry_saved`; they never touch signatures (architecture D1). The hard logic is already unit-tested in Phase 1 (`signature`, `webhook_payload`); this phase is the thin HA shell around it plus the repair issues that make misconfiguration visible.

**Depends on:** Phase 1 (`signature`, `webhook_payload`), Phase 3 (config entry with `webhook_id` + secret in options; coordinator `note_webhook`), Phase 0 (const, `dependencies:["webhook"]`).
**Produces:** `webhook.py`, `repairs.py` (webhook-related issues).
**Tested with:** HA's `aiohttp` test client through the real `webhook` component + the `signed_webhook_request` conftest helper (1.1, pinned to `signature` in 1.5).
**Architecture refs:** §2.1 (reactive path), §3.4 (inbound contract + verification order + replay caveat), §3.5 (events), D1 (central verification), D2 (compact events), C7 (repairs are wiring problems), setup.md Part 2.

Order: 6.1 register/unregister → 6.2 handler happy path → 6.3 rejection paths → 6.4 repairs.

---

## Chunk 6.1 — Register / unregister the endpoint

**Purpose:** stand up the per-entry webhook endpoint using the `webhook_id` minted at config time (3.1), honoring `local_only` (architecture §3.4, setup.md Part 2).

**Public surface:**
- `async_register_webhook(hass, entry)` — `webhook.async_register(hass, DOMAIN, "Miniflux", webhook_id, handler, local_only=options.local_only)`; called from `__init__` setup (3.4) **only when a secret is configured** (else 6.4 raises a repair instead).
- `async_unregister_webhook(hass, entry)` — `webhook.async_unregister`; called from unload (3.4).
- handler is a closure/partial bound to the entry so it can reach the entry's secret + coordinator.

**Tests first (red):**
- setup with a secret present → webhook registered at `webhook_id` (assert `async_generate_url` resolves and the handler is reachable).
- `local_only` option threaded through registration (True by default).
- unload → webhook unregistered (a later request 404s / not handled).
- setup with **no** secret → not registered; a repair issue raised (6.4).

**DoD:** register/unregister symmetric with entry lifecycle; no-secret path defers to repair, not a crash.

---

## Chunk 6.2 — Handler happy path (verify → project → emit → nudge)

**Purpose:** the §2.1 reactive pipeline, in strict order (architecture §3.4 "verification order is a hard invariant").

**Handler contract (order is the invariant):**
1. read **raw bytes**, bounded by `WEBHOOK_MAX_BODY_BYTES` (reject oversized before buffering more).
2. `signature.verify(secret, raw_body, provided_sig)` — on False → 401, emit nothing.
3. `signature.extract_event_type(headers)`.
4. `webhook_payload.parse_and_project(raw_body, event_type)` — on `PayloadError` → 400, emit nothing.
5. emit the projected event on `hass.bus` with `config_entry_id` + `instance_url` added (§3.5).
6. `coordinator.note_webhook()` → bump `last_webhook_at` + debounced refresh (D4).
7. return 200.

**Tests first (red)** (through HA's test client with a registered entry):
- a correctly `signed_webhook_request` for `new_entries` → **200**, exactly one `miniflux_new_entries` event on the bus with the compact payload (capped at `EVENT_ENTRIES_CAP`, `truncated` correct, **no `content` key**), and `last_webhook_at` updated + a debounced refresh requested.
- a signed `save_entry` → one `miniflux_entry_saved` event with a single `EntryCompact`.
- event payload carries `config_entry_id` + `instance_url` (multi-instance discriminator, §3.5).

**DoD:** end-to-end signed→event→200 green; the compact/no-content guarantee (D2) re-asserted at the HTTP boundary; coordinator nudged (D4).

---

## Chunk 6.3 — Rejection paths (the security surface)

**Purpose:** prove the bus is protected — nothing unverified emits (architecture D1, the event-bus trust crux).

**Tests first (red):**
- **bad signature** (right length, wrong bytes) → **401**, **no event** on the bus.
- **missing signature header** → 401, no event.
- **no secret configured** for the entry → 401, no event (the "delivering before wired" state, §2.1) + repair (6.4).
- **verified but malformed** body (valid signature over non-JSON / wrong shape) → **400**, no event (distinguishes tamper from version drift, §3.4).
- **oversized** body (> `WEBHOOK_MAX_BODY_BYTES`) → bounded rejection, no unbounded buffering, no event.
- an exception anywhere in the handler never escapes to the webhook framework as a 500 leaking internals — it maps to 400/401 (assert no unhandled 500).

**DoD:** every rejection returns the right status and emits **zero** events; the "unsigned never reaches the bus" invariant has direct tests (this is the phase's reason to exist).

---

## Chunk 6.4 — Repairs (make misconfiguration visible)

**Purpose:** wiring problems surface in HA's UI, not just logs (architecture C7, D10; setup.md troubleshooting).

**Public surface (`repairs.py` + calls from the handler/setup):**
- issue `webhook_secret_missing` — raised when setup finds no secret but the endpoint would be needed, or when a delivery arrives with no secret configured (rate-limited to once). Points at the options webhook step (D9). Deleted when a secret is saved.
- issue `webhook_signature_failing` — raised after **repeated** signature failures (likely a secret mismatch after Miniflux regenerated it on re-save, setup.md troubleshooting row 1). Cleared on the next verified delivery.
- both are simple "fix it" issues (link/description), not multi-step repair flows, unless a guided flow is cheap.

**Tests first (red):**
- no secret at setup → `webhook_secret_missing` issue present; after saving a secret (options flow) → issue cleared.
- N consecutive bad-signature deliveries → `webhook_signature_failing` raised (rate-limited: not one per request); a subsequent good delivery clears it.
- issues carry a translation key (strings finalized Phase 8) and a reference to the options step.

**DoD:** the two failure states from setup.md's troubleshooting table become visible repair issues that self-clear on fix (D10 "every failure has a visible home").

---

## Phase 6 exit criteria

- Signed delivery → typed event + 200; unsigned/malformed/oversized → 401/400 with **no bus event** — the D1 invariant is directly tested.
- Events are compact (no content, capped) at the HTTP boundary (D2).
- Coordinator nudged on receipt so sensors converge in seconds (D4).
- Misconfiguration (missing/failing secret) shows as self-clearing repair issues (D10, C7).
- Replay caveat (§3.4) mitigated by `local_only` default + documented advisory-events consumer rule (setup.md) — recorded as accepted residual risk in the Deviations footer, not "fixed."
