# 21 — Hardening implementation plan (all phases)

**Source findings:** [`20-real-ha-hardening.md`](./20-real-ha-hardening.md). **Open questions that gate parts of this plan:** [`22-hardening-open-questions.md`](./22-hardening-open-questions.md) — each unit below marks the question(s) it depends on as `[Qx]`. Every question has a proposed default, so answering "defaults fine" unblocks the entire plan.

**Correction to finding B6:** the refresh debounce *does* exist — server-side (`coordinator.py:52`, `Debouncer(cooldown=REFRESH_DEBOUNCE_SECONDS=10, immediate=True)`) — but it debounces the coordinator's own re-poll, not the `refresh_all_feeds` service call. Two rapid clicks still hit Miniflux twice. The card-side gap is a busy/disabled state (folded into H2-U3), not a missing debouncer.

**House rules carried over:** TDD per unit; after any `frontend/src` change run `npm run build` and commit the regenerated bundle (CI `check-bundle-fresh` enforces); backend units get tests in `tests/test_frontend.py`; coverage floors stay (100% runtime / 90% card views).

---

## Diagnostics playbook — what to do with each Phase-0 result

The user-side diagnostics (doc 20 Phase 0, restated as questions A1–A8 in doc 22) don't change *whether* Phase 1 happens — every H1 unit is justified independently. They change **remediation now** and **which H1-U3 branches get priority**:

| Diagnostic outcome | Meaning | Immediate remediation | Plan impact |
|---|---|---|---|
| Resources shows one entry, `?v=0.1.1.2`, cached probe = OLD | Pure browser cache | Hard-refresh / companion-app "Reset frontend cache" | None — H1-U1 kills the class |
| Resources shows old/absent `?v=` | Auto-reconciliation isn't running on this install | Edit URL to `?v=0.1.1.2`, hard-refresh | Check A3 logs → prioritize the H1-U3 branch that matches (timing vs import) |
| Two+ entries for the bundle path | Duplicate load; second `define` throws; first (stale) wins | Delete all but one, fix `?v=`, hard-refresh | Confirms H1-U3 dedupe + H1-U4 guard priority |
| An entry under `/local/…` (copied file) | Foreign stale copy that never updates | Delete the entry and the file in `/config/www` | Confirms H1-U3 foreign-copy detection |
| Server probe = OLD | The *installed files* are stale — the 0.1.1.2 update didn't actually land on disk | Reinstall / verify `custom_components/miniflux/frontend/miniflux-cards.js` on disk | Unrelated to cards; HACS install issue |
| A3 logs show "Lovelace not set up yet; skipping" | Bootstrap timing branch | Restart usually fixes once | H1-U3's started-event retry is the real fix |
| A8 = YAML-mode dashboards | Auto-reg impossible by design | Manual resource line (docs) | H1-U5/H4 docs path; Repair stays log-only [Q-B3] |

---

## Phase H1 — bulletproof delivery

### `H1-U1` — Serve the bundle with revalidation, not a 31-day cache `[Q-B1]`
**Files:** `custom_components/miniflux/frontend.py`, `tests/test_frontend.py`
**Behavior:** `StaticPathConfig(FRONTEND_URL_BASE, dir, False)` → plain `web.StaticResource`, ETag/Last-Modified revalidation each load. `?v=` cache-buster stays (harmless, still busts long-lived intermediary caches).
**Tests:** static path registered with `cache_headers=False`.

### `H1-U2` — Version stamp: bake the manifest version into the bundle `[Q-B2]`
**Files:** `frontend/scripts/build.mjs` (extend the existing `define` block), new `frontend/src/version.ts`, `frontend/src/index.ts`, both `*-card-editor.ts`
**Behavior:** build reads `custom_components/miniflux/manifest.json` → `define: { __MINIFLUX_CARDS_VERSION__: '"0.1.1.2"' }`. On module load, one standard console banner (`MINIFLUX-CARDS v0.1.1.2`, the custom-card convention). Version also rendered as a small footer line in each card editor, so "what's running" is visible without dev tools.
**Consequence:** every manifest version bump requires a bundle rebuild — `check-bundle-fresh` CI already enforces exactly this, and it turns the version bump commit into the cache-bust commit. `frontend/package.json`'s stale `"version": "0.1.0"` stops mattering (or is aligned in the same commit).
**Tests:** bundle smoke test asserts the version string is present in the built output; vitest asserts the banner fires once.

### `H1-U3` — Resource doctor `[Q-B3]`
**Files:** `custom_components/miniflux/frontend.py`, `const.py` (new `ISSUE_*` ids), `strings.json`, `tests/test_frontend.py`
**Behavior:**
1. **Dedupe:** all storage-mode resource entries whose URL-sans-query is the canonical path → keep one, reconcile its `?v=`, delete the rest.
2. **Retry on timing:** if `LOVELACE_DATA` isn't populated at entry-setup time, don't just debug-log and give up — register a one-shot `EVENT_HOMEASSISTANT_STARTED` listener and reconcile then.
3. **Loud skips:** every remaining skip branch logs at WARNING with the concrete reason and the docs link (YAML mode stays INFO — it's a supported configuration, not a failure).
4. **Repair issues:** `card_resources_unmanaged` (WARNING) when registration can't complete after the started-event retry; `card_resource_conflict` (WARNING) when a resource loads a `miniflux-cards.js` from a *non-canonical* path (e.g. `/local/…`) — fix text tells the user exactly which entry to delete. Both self-clear on next successful reconcile, matching the existing webhook-repair pattern (`repairs.py`).
**Tests:** one per branch — dedupe, retry-then-succeed, retry-then-issue, foreign-path issue + self-clear, YAML-mode stays quiet.

### `H1-U4` — Double-load guard in the bundle
**Files:** `frontend/src/cards/register-card.ts`, both card modules' `customElements.define` call sites (route through one `defineCard()` helper)
**Behavior:** if the element name is already defined, skip redefinition and `console.error` a self-diagnosing message ("Two copies of the Miniflux card bundle are loading — remove the stale Lovelace resource; see docs") instead of throwing an opaque `DOMException` that kills the rest of the module. `window.customCards` push also dedupes by `type`.
**Tests:** importing the module twice → no throw, one picker entry, error logged.

### `H1-U5` — Docs delivery fixes
**Files:** `docs/setup.md`
**Behavior:** replace the hardcoded `?v=0.1.0` with "use the installed version"; add the resource-troubleshooting rows (stale `?v=`, duplicates, `/local` copies, hard-refresh/companion-app cache reset) distilled from the playbook above.

**Phase exit criteria:** upgrade + restart + normal page reload on a real instance provably runs the new bundle (banner shows the new version), *or* a Repair issue tells the user exactly why not. No silent branch remains.

---

## Phase H2 — cards that fail honestly (never blank)

### `H2-U1` — Load-state machine + shared status views
**Files:** new `frontend/src/atoms/mf-card-status.ts`; `feed-manager-card.ts`, `category-manager-card.ts`
**Behavior:** every card render is one of `loading` (spinner/skeleton) / `error` (message verbatim + **Retry** button) / `empty` ("No feeds yet — ＋ Add feed" CTA; category card equivalent) / `not-configured` ("Set up the Miniflux integration first" + docs link, rendered when resolution finds no instance) / `ready`. All load paths caught — the `void this._loadFeeds()` unhandled-rejection pattern is eliminated; `_configEntryId` resolution happens once per hass-change into state, not per-call-site throws.
**Tests:** each state renders for each card; a load rejection lands in `error` with the message; Retry re-queries; no-instance hass lands in `not-configured` without throwing.

### `H2-U2` — Honest offline `[Q-B6]`
**Files:** both cards, `mf-offline.ts` (export the reachability check)
**Behavior:** while `binary_sensor.miniflux_reachable` is `off`, mutating controls (add/edit/delete/refresh/mark-read/enable-disable) are actually `disabled`, matching the banner's existing claim. List rendering stays (last-known data).
**Tests:** unreachable state disables the controls; recovery re-enables.

### `H2-U3` — Busy states + double-submit guards + wizard input UX
**Files:** both cards
**Behavior:** every async button (Discover/**Search**, Subscribe, Save, Refresh-all, per-row actions already pending-aware) disables itself and shows progress while in flight; wizard gets an explicit **Search** button and Enter-to-submit on the URL field (today it's blur-only `change`, which reads as dead). Covers the refresh-all gap (see correction above).
**Tests:** in-flight click is a no-op (exactly one service call); button re-enables on resolve/reject.

### `H2-U4` — Wire `GenerationGuard` into list loads
**Files:** both cards' `_loadFeeds`/`_loadCategories`, pickers
**Behavior:** the already-built-and-tested guard (`src/lib/`) drops stale in-flight responses so an older slow query can't overwrite a newer result.
**Tests:** out-of-order resolution keeps the newest generation's data.

### `H2-U5` — Grouping survives virtualization `[Q-A7]`
**Files:** `feed-manager-card.ts`, `feed-list-helpers.ts`
**Behavior:** >100 feeds: flatten groups into a single item stream containing header rows + feed rows, rendered through `mf-virtual-list` (fixed row heights per kind), so `group_by: category` holds at any scale. Priority informed by A7 (real feed count).
**Tests:** 500 feeds → headers present in the virtualized stream, order correct.

**Phase exit criteria:** unplugging Miniflux, an empty instance, a forced service error, and a fresh install with no integration each produce a *self-describing* card. Blank is unreachable.

---

## Phase H3 — native look & feel

### `H3-U1` — Real stylesheet `[Q-C1]`
**Files:** new shared style module (e.g. `frontend/src/cards/card-styles.ts`), both cards
**Behavior:** since cards render light-DOM, each card renders one `<style>` block from the shared module. HA theme vars only (`--primary-text-color`, `--secondary-text-color`, `--divider-color`, `--error-color`, `--warning-color`, `--card-background-color`, `--ha-card-border-radius`): row grid + density, monogram avatar chip, unread/error/paused badges, group headers, dialogs/sheets as overlay panels instead of inline stacked divs, hover/focus-visible states, dark-mode-correct by construction (vars).
**Tests:** smoke (style block present, key classes covered); the real acceptance is the user's side-by-side review against native cards.

### `H3-U2` — Icon system `[Q-B5]`
**Files:** both cards, atoms
**Behavior:** replace emoji glyph buttons with `<ha-icon>`-based icon buttons (mdi: refresh, check-all, pencil, delete, pause, alert, plus), `title` + `aria-label` on all; consistent 40–44px touch targets.
**Tests:** icons render with correct `icon` attrs; aria-labels preserved.

### `H3-U3` — Editors: full option coverage, native look `[Q-B4]`
**Files:** both `*-card-editor.ts`, `mf-card-editor-base.ts`
**Behavior:** every documented option editable visually — feed card adds `category` (via the existing `mf-category-picker`) and `height`; category card adds `sort` and anything missing. Controls styled to match HA forms (per Q-B4 default: own controls + theme vars, not the internal `ha-form` API). Version footer from H1-U2.
**Tests:** each option round-trips through `config-changed`.

### `H3-U4` — Narrow-width behavior
**Files:** both cards + styles
**Behavior:** below a width threshold, secondary per-row actions (edit, enable/disable, mark-read) collapse into an overflow (⋮) menu; primary action + delete stay visible. Cards stay usable in a 1-column mobile dashboard.
**Tests:** narrow container renders overflow menu; actions still reachable.

**Phase exit criteria:** side by side with a first-party card, nothing looks foreign; every option is settable without touching YAML.

---

## Phase H4 — docs + validation loop

1. **`H4-U1`** — Update `docs/cards/feed-manager-card.md` for the new states/behaviors + a Troubleshooting section (the playbook table, user-facing). Remove flagged caveats that phases 1–3 fixed.
2. **`H4-U2`** — User re-runs the validation checklist on the real dashboard; defects loop back as point fixes.
3. **`H4-U3`** — Category-manager card doc (existing task) written against the hardened card, same validate-and-fix loop.
4. **`H4-U4`** — Release per cadence decision `[Q-B7]`: recommended — merge PR #8 to `main`, tag each phase (e.g. `0.1.2` = H1, `0.1.3` = H2, `0.2.0` = H3) so every phase gets a real-dashboard shakedown while the next is in flight.

---

## Sequencing

`H1 → H2 → H3 → H4`, each phase one PR-sized push to the existing branch (PR #8) with rebuilt bundle. H1 first because until delivery is trustworthy and the running version is visible, no other fix is *verifiable* on a real instance — we'd keep "fixing" things the browser never loads. H2 makes remaining defects self-describing, which makes the H4 validation loop cheap. H3 is deliberately last: pure polish on top of correct behavior.
