# Phase 8 — Diagnostics, i18n, README & Release

**Goal:** the polish that makes the integration debuggable, localizable, presentable, and shippable through HACS. Nothing here changes runtime behavior; it makes the behavior legible and cuts the release. Do this last because it references every user-visible string and event the prior phases produced.

**Depends on:** Phases 3–6 (flows, entities, services, webhook, repairs — everything that has a string or a diagnostic surface).
**Produces:** `diagnostics.py`, `strings.json` + `translations/en.json`, finalized `README.md`, brand/logo submission note, `LICENSE`, release tag + notes.
**Architecture refs:** C7 (diagnostics), D10 (debuggable from UI), setup.md (user docs), R1/R3/R7 (carried risks), overview §8 (whole-integration DoD).

Order: 8.1 diagnostics → 8.2 translations → 8.3 README/brand/license → 8.4 release.

---

## Chunk 8.1 — Diagnostics (redacted)

**Purpose:** one-click bug-report dump that never leaks secrets (architecture C7).

**Public surface:**
- `async_get_config_entry_diagnostics(hass, entry)` → redacted dict: entry data/options with `api_key` and `webhook_secret` **redacted** (use HA's `async_redact_data`); coordinator health (`last_success_at`, `last_error`, `server_version`, `last_webhook_at`, `update_interval`); snapshot summary (feed count, unread total, starred total, error-feed count — **counts, not entry content**, keeping the recorder/log clean per D2); webhook registered? secret present? (boolean, not the value).

**Tests first (red):**
- `api_key` and `webhook_secret` never appear in the output (assert redaction markers present, raw values absent).
- health + snapshot-summary fields present and correct for an injected coordinator.
- no entry content / no raw entries in the dump (D2 discipline).

**DoD:** secrets provably redacted; summary useful for triage without dumping content.

---

## Chunk 8.2 — Translations (`strings.json` + `translations/en.json`)

**Purpose:** localized names/descriptions for flows, entities, services, and repair issues; hassfest validates key coverage.

**Produces:** keys for —
- **config flow:** step titles, field labels/descriptions, error keys (`invalid_auth`, `cannot_connect`, `unknown`), abort (`already_configured`).
- **reauth:** reauth confirm strings.
- **options flow:** settings + webhook steps; the webhook URL description placeholder; `local_only` label; the "paste the secret Miniflux generated" instruction (D9 / setup.md Part 2).
- **entities:** friendly names for the four entities (`has_entity_name` → these are the entity name parts).
- **services:** names + descriptions + field descriptions mirroring `services.yaml`, incl. the `mark_all_read` race warning and `fetch_original` slow-path note.
- **issues:** `webhook_secret_missing`, `webhook_signature_failing` titles/descriptions with the fix pointer.

**Tests first (red):**
- hassfest translation check passes (gate).
- a test asserting every config/options error+abort key raised in code has a matching translation key (no untranslated user-facing string); same for the two repair issues.

**DoD:** hassfest green on translations; no code-raised key lacks a string.

---

## Chunk 8.3 — README, brand/logo, license

**Purpose:** the HACS-rendered landing page and legal/branding bits.

**Produces:**
- `README.md` (replaces the stub): what it is; **HACS custom-repository install steps**; the two-phase webhook setup summary linking to [`docs/setup.md`](../docs/setup.md); the entity/service/event catalog (link to [`docs/architecture.md`](../docs/architecture.md) §3.5/§3.6); a **Known limitations** section carrying R3 (no tag-write; engagement = starred + save event) and the replay caveat (§3.4). HACS badge + minimum HA version (R7).
- **Brand/logo note:** to clear the HACS/hassfest brand warning and get an icon, submit a logo to `home-assistant/brands` (`custom_integrations/miniflux`). Document as a follow-up PR to that repo — not required for custom-repo install, but listed so the warning is understood, not mysterious (Phase 0 0.2).
- `LICENSE` (pick one; MIT unless the owner says otherwise — flag as a question if unset).

**Tests first (red):** mostly non-code —
- a link-check / presence test that README references install, setup.md, and lists all four entities + the four event types + the service names (guards against README drifting from the code).

**DoD:** README renders in HACS; known-limitations honestly lists R3 + replay; brand path documented.

---

## Chunk 8.4 — Release & HACS distribution

**Purpose:** cut a versioned release HACS can install, and record the distribution path.

**Steps (process, not code):**
- confirm `manifest.json` `version` bumped (semver) and matches the git tag.
- full suite green; coverage floors met; hassfest + HACS action green (brand warning acceptable, 8.3).
- create a GitHub **release** with a tag (e.g. `v0.1.0`); release notes summarize features and **carry the still-open risks as known limitations** (R1 pinned-version note, R3 tag-write, R7 HA floor).
- **HACS distribution:** works immediately as a *custom repository* (owner adds the repo URL, category Integration). Optionally submit to the HACS default list later (a separate PR to `hacs/default` with the repo meeting HACS's default-inclusion criteria) — document as optional follow-up, not a release blocker.
- verify install-from-release in a clean HA (or note it as the manual acceptance step tied to overview §8 DoD).

**Tests / gate:**
- CI on the tag: hassfest ✅, HACS ✅, pytest ✅.
- manual: add as HACS custom repo → install → configure → four entities → run the setup.md verification (force a Miniflux refresh → `miniflux_new_entries` event + `last_webhook_at` updates).

**DoD:** a `v0.1.0` release exists and installs via HACS custom repository; overview §8 whole-integration DoD satisfied.

---

## Phase 8 exit criteria (= project DoD, overview §8)

- Installs via HACS custom repository; UI config produces the four entities; two-phase webhook works end to end.
- All services callable, correct envelopes, loud failures.
- Degraded states visible (reachability + feeds-with-errors sensors, feed events, reauth, repair issues); secrets redacted in diagnostics.
- hassfest + HACS green; coverage floors met; release tagged.
- Risks R1–R10 resolved or carried explicitly into release notes (R3 no-tag-write and the R1 version-pinning note are the two that ship as known limitations).
