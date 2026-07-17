# Phase 1 progress — where we are, exactly

**Last updated:** 2026-07-17
**Scope:** the Phase 1 build described in [`00-START-HERE.md`](./00-START-HERE.md) — Foundation → `G2` → C3 feed manager → `G1` → C4 category manager. Nothing here touches Phase 2 (reader, search, triage, health, OPML, activity, rich-content).

This file tracks Phase 1 specifically. `STATUS.md` at the repo root remains the ground-truth snapshot for the backend (services/sensors/webhook) that shipped before this frontend work started.

---

## Done: `F-U1` — bundle scaffolding, build, delivery (step 1 of 19)

The delivery **spike** required by D-9 before any other foundation unit — prove the whole in-repo delivery mechanism works before writing 12 more units on top of it. **Stopped here on purpose** for a real-HA validation pass before continuing, per the build instructions.

**What was built:**

- `frontend/` — a self-contained TypeScript + [Lit](https://lit.dev) subtree (D-5): its own `package.json`, `tsconfig.json`, esbuild build script, Vitest smoke test. Zero intermingling with the Python tree.
- `frontend/src/spike-card.ts` — a throwaway `<miniflux-spike-card>` custom element. **Not** a Phase 1 feature card — its only job is to render something visible in a real dashboard so the delivery pipeline can be confirmed end-to-end by looking at it, not just by reading test output. Delete it once C3/C4 exist and the real-HA pass is done.
- `custom_components/miniflux/frontend/miniflux-cards.js` — the committed, built bundle (15.8 kB, self-contained — Lit is bundled in, no CDN fetches, CSP-clean).
- `custom_components/miniflux/frontend.py` — the one integration-code change:
  - Registers `/miniflux/frontend/*` as a static path once per HA run (idempotent across reloads/restarts).
  - Auto-adds the bundle as a Lovelace **module** resource on storage-mode dashboards, with a `?v=<integration version>` cache-buster; reconciles in place on version bumps (same resource id, new URL) rather than duplicating.
  - YAML-mode dashboards can't be edited programmatically — logs and points at the manual resource line now documented in `docs/setup.md`.
  - No lovelace loaded / lovelace component missing → both degrade to a no-op, never an exception.
- Wired into `custom_components/miniflux/__init__.py`: `async_setup_entry` now calls `async_register_frontend(hass)` alongside service/webhook registration.
- Tests: `tests/test_frontend.py` (9 focused cases — static path registered once, resource created/not duplicated/updated in place on version bump, YAML-mode skip, no-lovelace skip, lovelace-unimportable skip) plus a wiring-proof case added to `tests/test_init.py`. `frontend.py` is at **100% line+branch coverage**.
- CI: `.github/workflows/test.yml` gained a `frontend` job — `npm ci` → `typecheck` → `npm test` (Vitest, `happy-dom`) → `check-bundle-fresh` (fails if the committed bundle doesn't byte-match a fresh `npm run build`, so a stale bundle can never ship).
- `docs/setup.md` — new "Lovelace card bundle" subsection under Part 1, documenting the storage-mode zero-config behavior and the YAML-mode manual resource line.

**Full suite status at this commit:** 458 Python tests passing, all 20 covered backend modules at their required floor (frontend.py and every pure-core module at 100%, api.py at its pre-existing accepted 99%). Frontend: typecheck clean, Vitest smoke test passing, bundle byte-matches a fresh build.

**What is explicitly NOT proven yet — this is the gate before continuing:**
- The integration has never loaded inside a **real** Home Assistant. Every check above ran against `pytest-homeassistant-custom-component`'s simulated harness or Vitest's `happy-dom` — high-fidelity, but simulated.
- Whether `async_register_frontend` actually wins the component-load-order race in a real HA boot (lovelace being ready by the time this integration's config entry sets up) has only been exercised by explicitly setting up `http`+`lovelace` first in tests — real HA's own boot ordering hasn't been observed.
- Whether the `<miniflux-spike-card>` genuinely shows up in the "+ Add Card" picker with zero manual resource setup, on a real storage-mode dashboard, has not been visually confirmed.
- GitHub Actions hasn't run the new `frontend` CI job or re-run `hassfest`/HACS validation against these changes yet.

**This is the checkpoint:** add the card to a real dashboard, confirm it renders, confirm no manual resource step was needed, then say so — that's what unblocks step 2.

---

## Not started: steps 2–19

Everything below `F-U1` in the [build order](./00-START-HERE.md#2-phase-1--the-exact-build-order) is **not started**. Listed here so it's obvious what "the rest of Phase 1" actually is — this is not a status claim, just the plan's own table for reference:

| Step | Unit | One-line purpose |
|---|---|---|
| 2 | `F-U2` | Vitest harness + `FakeHass` — the permanent frontend test rig everything after this depends on |
| 3 | `G2` | Backend: per-feed unread count joined onto `get_feeds` from the poll snapshot |
| 4 | `G1` | Backend: new `get_categories` service (including empty categories) |
| 5 | `F-U3` | `MinifluxApi` config-entry auto-resolution |
| 6 | `F-U4` | Typed service wrappers (12 of the 17 services Phase 1 needs) |
| 7 | `F-U5` | Chunking, error normalization, request generations |
| 8 | `F-U6` | `MinifluxStore` cache + keys + isolation |
| 9 | `F-U7` | Refresh bus (poll-tick + admin event + local mutation invalidation) |
| 10 | `F-U8` | Optimistic layer + rollback |
| 11 | `F-U9` | `<mf-confirm>` (two-step, plus hold-to-confirm variant) |
| 12 | `F-U10` | `<mf-feed-picker>` / `<mf-category-picker>` |
| 13 | `F-U11` | Offline banner, truncation notice, toast host |
| 14 | `F-U12` | Virtualized list (500+ row case) |
| 15 | `F-U13` | Card registration + shared editor base |
| 16 | `C3-U1..U5` | **Feed manager card** — create (discover), read, update, delete, refresh, mark-read, enable/disable |
| 17 | `C4-U1..U4` | **Category manager card** — create, read (incl. empty), rename, delete (hold-to-confirm) |
| 18 | `F-U14` | Bundle smoke + no-leak check (only intended globals/elements exposed) |
| 19 | Real-HA validation | The full Phase 1 "done" gate — [`00-START-HERE.md` §3](./00-START-HERE.md#3-phase-1-done-gate-real-ha-validation--d-2) |

None of this is built. The `<miniflux-spike-card>` currently in the bundle is **not** C3 or C4 — it is scaffolding that gets deleted once those exist.

## Explicitly out of scope for all of Phase 1 (not just this step)

Per D-1: the reader, search, triage, health, OPML, and activity cards, and the rich-content pipeline. Also deferred: backend gaps `G3` (offset), `G5` (enclosures), `G6` (feed icons — so C3/C4 render **no favicons**, letter-avatar or nothing), `G7` (readability), `G8` (comments_url). None of this changes until Phase 1 ships and is validated.

## What "done" looks like for all of Phase 1

The full gate is [`00-START-HERE.md §3`](./00-START-HERE.md#3-phase-1-done-gate-real-ha-validation--d-2) — cards in the picker with zero manual resource setup, full CRUD reachable on both cards with zero gaps, unread badges reflecting the last poll, honest offline degradation, and CI green (hassfest/HACS + JS build/freshness + JS and Python tests + coverage floors). Only after that gate does the maintainer decide whether to cut a release.
