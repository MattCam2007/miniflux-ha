# Method & Conventions (shared by every detailed plan)

This document fixes the vocabulary the other plans reuse: what a "unit of work" is, how it is tested, when it is done, and the baselines (sanitization, accessibility, theming) every unit inherits so they are not restated per card.

---

## 1. Unit-of-work anatomy

Every unit in these plans has exactly this shape:

> **`<ID>` — Title**
> **Depends on:** other unit IDs (or "—")
> **Deliverable:** one sentence — the file/artifact this unit produces.
> **Behavior:** the observable spec, as bullets.
> **Tests:** the explicit red-green target — the cases that *define* done. Written first.
> **DoD:** the Definition-of-Done checklist for this unit (extends the global DoD in §4).

**Sizing rule.** A unit is correctly scoped when its **Tests** list can be written using only units it declares as dependencies. If a test would require an unbuilt sibling, the unit is too big — split it. Most units are ½–1½ day.

**ID scheme.** `F-U*` foundation · `RC-U*` rich-content pipeline · `G*` backend gap-enablers · `C1-U*`…`C9-U*` per card. IDs are stable references; other docs cite them.

---

## 2. Frontend test harness (the one all card/atom units use)

The backend already has its TDD ring (`pytest` + `pytest-homeassistant-custom-component`, 448 tests, 100% branch except an accepted 99% in `api.py`). The frontend needs its own, established once in `F-U2`:

- **Runner:** [Vitest](https://vitest.dev) with the `happy-dom` (or `jsdom`) environment for custom-element rendering.
- **`hass` double:** a hand-written `FakeHass` exposing `states`, `callWS`, `callService` (with `return_response`), `connection.subscribeEvents`, `connection.subscribeEntities`, and `user.is_admin`. Every service response is scripted per test; no network.
- **Element mounting:** `fixture()` helper that `customElements.define`s the element under test, attaches it to a detached document, sets `.hass`/`.config`, and awaits `updateComplete` (Lit).
- **Interaction:** synthetic events (`click`, `keydown`, `pointer*`) dispatched at shadow-DOM nodes; assertions read rendered shadow DOM.
- **Time:** `vi.useFakeTimers()` for debounce/TTL/undo-window assertions — no real waits.
- **Coverage gate:** shared runtime (api, store, sanitizer, filter mapping) held to 100% line/branch like the backend; card view code to a declared floor (proposed 90% — see `QUESTIONS-ISSUES-CONCERNS.md` Q7).

Three test *rings*, mirroring the backend's:

| Ring | What | Example |
|---|---|---|
| **Pure** | Framework-free logic — sanitizer, filter→params, cursor pager, undo stack, cache keys, enclosure classifier | "audio/mpeg enclosure → `audio` kind"; "2 equal-timestamp pages dedupe by id" |
| **Component** | One custom element against `FakeHass` | "star click fires `update_entries{starred:true}` and flips the icon optimistically" |
| **Contract** | The typed `MinifluxApi` wrapper against scripted `callService` responses | "get_entries chunks >100 ids into 2 calls and merges" |

## 3. Backend gap-units use the existing pytest ring

`G1`–`G8` are **integration code**, not frontend. They follow the repo's existing TDD process (`tests/test_services.py`, `tests/test_api.py`, `tests/test_normalize.py`, `tests/fixtures/synthetic/*`) and the seam rules in `docs/architecture.md §8.4`. Each gap-unit's **Tests** list names the concrete pytest cases and the fixture(s) it adds/extends. A gap-unit is done only when coverage floors in `scripts/check_coverage_floors.py` still pass.

---

## 4. Global Definition of Done (every unit inherits this)

- [ ] Tests written first, red before green, all green after.
- [ ] Coverage floor for the touched layer holds (100% shared runtime / backend; card-view floor per Q7).
- [ ] No new external network requests from the bundle (CSP/offline rule — `F-U1`); no new runtime dependency without a note in the concerns doc.
- [ ] Sanitization baseline (§5) holds for anything that renders feed-supplied strings.
- [ ] Accessibility baseline (§6) holds for any new interactive control.
- [ ] Theme baseline (§7): renders correctly in HA light and dark themes.
- [ ] Offline baseline (`DC7`): degrades honestly when `binary_sensor.*_reachable` is `off`.
- [ ] If the unit adds a service call, it goes through `MinifluxApi` (never a raw `callService`) so chunking/error-normalization/request-generations apply.
- [ ] Public-facing config keys, events, or payload fields are documented in the owning card's usage section in the same change.

## 5. Sanitization baseline (load-bearing for rich content — `S10`)

Feed content and every feed-supplied string (titles, author, categories, error messages, event payloads) are **untrusted**. The rules, defined once in `RC-U1`/`RC-U2` and inherited everywhere:

- HTML content renders through the sanitizer (`RC-U1`) — an **allowlist** of tags/attributes; scripts, event handlers, `javascript:`/`data:` (non-image) URLs, `<style>`, `<iframe>` (except an allowlisted embed set, `RC-U6`), form elements, and CSS expressions are stripped.
- Non-HTML strings render as **text nodes**, never `innerHTML`.
- Truncation/clamping is **CSS** (`line-clamp`, `text-overflow`), never data mutation — a 10k-char title must not be able to break layout or be silently rewritten.
- Images are lazy, sandboxed to `img-src` the CSP allows, and never leak a referrer that deanonymizes the user beyond what opening the article would (`RC-U5`, and Q3 on the image-proxy question).

## 6. Accessibility baseline

- Every actionable icon has an `aria-label` and a ≥44px touch target.
- Keyboard: all interactive controls reachable and operable by keyboard; focus visible; card-level keyboard handlers (C7) do not trap focus or hijack global keys while another control is focused.
- Live regions: async result counts and toasts use `aria-live="polite"`; errors `assertive`.
- Color is never the sole carrier of state (offline, error, unread) — pair with icon/text.

## 7. Theme & layout baseline

- Use HA CSS custom properties (`--primary-text-color`, `--card-background-color`, `--divider-color`, …); no hard-coded colors that break a theme.
- Respect `prefers-reduced-motion` for swipe/flip animations (C7) and activity flashes.
- Body never scrolls horizontally; wide content (code blocks, tables, media) scrolls inside its own `overflow-x:auto` container.
- Cards implement `getCardSize()`/`getGridOptions()` for the sections view.

## 8. Definition of "individually testable"

A unit is individually testable iff, with only its declared dependencies built, its **Tests** list is fully writable and runnable green. This is the property that lets the build proceed one unit at a time with a passing suite at every commit — the same invariant the backend already holds.
