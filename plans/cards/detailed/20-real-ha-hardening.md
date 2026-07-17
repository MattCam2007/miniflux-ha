# 20 — Real-HA Hardening: make the cards work and not suck

**Date:** 2026-07-17 · **Trigger:** first real-dashboard validation (0.1.1.2) failed the same way 0.1.1 did, and the user had to add Lovelace resources by hand despite the "no manual resource step, ever" promise.

This plan is the product of a deep dive across `frontend/src/`, `custom_components/miniflux/frontend.py`, and Home Assistant core source (dev branch, fetched 2026-07-17). Findings are ranked by how directly they explain "it's a lot of work to configure these cards, and they just don't seem to want to work."

---

## Root-cause findings

### A. Delivery pipeline — why fixes "don't take" and resources needed manual setup

**A1. The bundle is browser-cached for 31 days with no revalidation.**
`frontend.py` registers the static path with `StaticPathConfig(..., True)` → HA's `CachingStaticResource` → `Cache-Control: public, max-age=2678400` (verified in core `components/http/static.py`). Any resource URL whose `?v=` doesn't change serves month-old JS. This is the standing explanation for "upgraded, same error": the Python side updates, the JS in the browser doesn't.

**A2. Nothing identifies the running bundle version.** The built JS contains no version string (verified by grep), no console banner, nothing in the UI. A stale bundle is *indistinguishable* from a broken one — for us and for any user.

**A3. Resource auto-registration fails silently in all three failure branches** (`frontend.py:59-82`): lovelace import error → `debug` log; lovelace not ready → `debug` log; YAML mode → `info` log. No Repair issue, no warning. If it fails, the user's only symptom is "cards aren't in the picker," with zero pointer to why. (Import paths `lovelace.const.LOVELACE_DATA` / `resources.ResourceStorageCollection` are valid on current core dev — verified — so the *mechanism* is sound; the *observability* is absent.)

**A4. No duplicate/foreign-resource handling.** A manually added resource (a second entry for the same bundle, or a copy under `/local/`) loads the module twice → the second `customElements.define` throws `DOMException` → whichever copy loaded first (often the stale one) wins silently. `register-card.ts`/`customElements.define` are unguarded.

**A5. `docs/setup.md` hardcodes `?v=0.1.0`** in the YAML-resources example — anyone who copy-pasted it is pinned to a permanently stale cache key.

### B. Card runtime — why failures look like "the card just doesn't work"

**B1. Initial-load errors are swallowed.** `void this._loadFeeds()` in `willUpdate` (`feed-manager-card.ts:136`; same pattern in the category card and pickers) → a rejection is unhandled → the card renders *blank forever* with the real error only in the browser console. This is why the 0.1.1 bug looked like "no data at any point" instead of an error.

**B2. No loading / empty / error / not-configured states at all.** Blank while fetching, blank on failure, blank with zero feeds, hard console error when the integration isn't set up.

**B3. The offline banner lies.** `mf-offline` says "actions are disabled" but is purely visual — every button stays clickable and fails with a toast.

**B4. No busy states on async buttons.** Discover/Subscribe/Save/Refresh-all give no feedback while in flight and allow double-submit (double `create_feed`). Discovery triggers only on the URL field's `change` (blur) — no Search button, no spinner.

**B5. Virtualization silently drops grouping.** Past 100 feeds, `group_by: category` stops applying (`feed-manager-card.ts:445`).

**B6. The claimed refresh-all debounce (S2) does not exist.** No debounce code anywhere in the card; the test named for it only asserts an error toast.

**B7. `GenerationGuard` (stale-response dropper, `src/lib/`) is built, tested, and wired into nothing.**

### C. Look & feel — the "suck" factor

**C1. The cards ship ZERO CSS for their own DOM.** They render into light DOM with classes (`.feed-row`, `.avatar`, `.badge`, `.toolbar`…) that no stylesheet anywhere defines (verified by grep — no `static styles`, no `<style>` in either card). Every row, button, and dialog renders as unstyled browser defaults inside an `ha-card`.

**C2. Emoji as action icons** (⟳ ✓ ✎ 🗑 ⏸ ⚠ ＋) instead of `ha-icon-button`/MDI — visually inconsistent with every native card.

**C3. Editors are raw `<select>`/`<input>` elements** — not HA form components — and omit `category` and `height` entirely (YAML-only today).

### D. Verified sound — no action needed

- Display-registry `platform` is **unconditionally present** in real HA (core `entity_registry.py::_as_display_dict` always emits `"pl"`) → the 0.1.1.2 config-entry fix mechanism is valid.
- `config_entry_id` is `vol.Optional` in every service schema; the backend auto-resolves a single instance (`services.py::_resolve_entry`).
- `hass.callService(..., returnResponse)` signature and `connection.subscribeEvents` match real HA.

---

## Phase 0 — user-side diagnostic (5 minutes, no code)

Confirms which staleness branch is live on the real instance:

1. **Settings → Dashboards → ⋮ → Resources.** Note every entry mentioning miniflux: exact URL incl. `?v=`, and whether there's more than one (or a `/local/…` copy).
2. On a dashboard, open the browser console and run:
   ```js
   const probe = async (cache) => (await (await fetch('/miniflux/frontend/miniflux-cards.js', {cache})).text()).includes('__miniflux_default__') ? 'NEW (has fix)' : 'OLD (pre-fix)';
   console.log('server:', await probe('reload'), '| browser cache:', await probe('force-cache'));
   ```
   On 0.1.1.2 the server copy must say NEW. If the cached copy says OLD, staleness is confirmed.
3. **Unblock now:** set the resource URL to `/miniflux/frontend/miniflux-cards.js?v=0.1.1.2`, delete any duplicates/`/local` copies, hard-refresh (Ctrl+Shift+R; companion app: Settings → Companion app → Debugging → Reset frontend cache).

## Phase 1 — bulletproof delivery ("updates always take")

1. Serve the bundle with `cache_headers=False` → plain `web.StaticResource`, ETag revalidation per load. One conditional request for a 57 KB file per dashboard load; correctness beats the micro-optimization. `?v=` stays as belt-and-braces.
2. Embed `BUNDLE_VERSION` at build time (esbuild `define` from `package.json`) + standard console banner (`MINIFLUX-CARDS vX.Y.Z`) on load, version surfaced in each card editor. Staleness becomes diagnosable at a glance.
3. Resource doctor in `frontend.py`: keep the canonical entry reconciled (already does), **also** remove duplicate entries pointing at the bundle path, log every skip branch at WARNING with the reason, and raise a Repair issue when (a) registration can't complete or (b) a foreign resource loading a `miniflux-cards` bundle from another path is detected.
4. Guard `customElements.define` in `register-card.ts`: on redefinition, console.error naming both script URLs ("two copies of the Miniflux bundle are loading — remove the stale resource") instead of an opaque DOMException.
5. Fix the `?v=0.1.0` hardcode in `docs/setup.md`.

## Phase 2 — cards that fail honestly (never blank)

1. Load state machine per card: `loading → ready | error(message, Retry) | empty("No feeds yet — add one") | not-configured("Set up the Miniflux integration first")`. Every load path caught; no more `void`-swallowed rejections.
2. Honest offline: actually disable mutating controls while `binary_sensor.miniflux_reachable` is off (the banner already claims this).
3. Busy/disabled states on Discover/Subscribe/Save/Refresh-all; explicit Search button + Enter-to-submit in the wizard.
4. Wire `GenerationGuard` into the list loads; implement the promised refresh-all debounce (or delete the claim from plans/tests — implement is preferred, it's ~10 lines).
5. Virtualized path keeps group headers (flatten groups into one item stream containing header rows).

## Phase 3 — native look & feel

1. A real stylesheet for the cards' light DOM using HA theme vars (`--primary-text-color`, `--secondary-text-color`, `--divider-color`, `--error-color`…): row layout, density, avatar chips, badges, dialogs, hover/focus states, mobile widths.
2. `ha-icon-button` + MDI icons replacing all emoji glyphs; secondary actions collapse into an overflow menu on narrow cards.
3. Editors rebuilt on `ha-form`/selectors with **all** options (including `category` and `height`), native styling, proper labels/helper text.

## Phase 4 — docs + validation loop

1. Update `docs/cards/feed-manager-card.md`: new states, version banner, and a Troubleshooting section covering resources/caching (the exact failure the user just hit).
2. Re-run the validation checklist on the real dashboard.
3. Then the category-manager card doc + the same loop (existing task), inheriting all phase 1–3 fixes.

## Sequencing rationale

Phase 1 first: until delivery is trustworthy and versions are visible, *no* card fix is verifiable on a real instance — we'd keep "fixing" things the browser never loads. Phase 2 makes every remaining defect self-describing instead of blank. Phase 3 is pure polish once behavior is right. Each phase is one PR-sized unit on the existing branch (PR #8), bundle rebuilt per the CI freshness guard.
