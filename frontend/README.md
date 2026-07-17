# Miniflux Lovelace cards — frontend subtree

Self-contained TypeScript + [Lit](https://lit.dev) subtree (D-5): its own
`package.json`/`tsconfig.json`/build, zero intermingling with the Python
integration. The only thing the Python side knows about this directory is
that a built bundle exists at `custom_components/miniflux/frontend/miniflux-cards.js`
(see `../custom_components/miniflux/frontend.py`).

## Commands

Run from this directory (`frontend/`):

| Command | Does |
|---|---|
| `npm ci` | Install exact locked dependencies |
| `npm run build` | esbuild-bundle `src/index.ts` → `../custom_components/miniflux/frontend/miniflux-cards.js` |
| `npm run check-bundle-fresh` | CI guard: fails if the committed bundle doesn't byte-match a fresh build |
| `npm test` | Run the Vitest suite (`happy-dom` environment) |
| `npm run typecheck` | `tsc --noEmit` |

**After any change under `src/`, run `npm run build` and commit the regenerated bundle.** CI enforces this (`check-bundle-fresh`) — a stale bundle fails the build.

## Current state (F-U1 spike only)

This subtree currently ships exactly one throwaway element, `<miniflux-spike-card>`
(`src/spike-card.ts`), whose only purpose is proving the delivery pipeline
end-to-end per `plans/cards/detailed/00-START-HERE.md` D-9: build → commit →
static path → auto-added Lovelace resource → renders in a real dashboard
with zero manual resource setup. It is **not** a Phase 1 feature card and
will be deleted once C3 (feed manager) and C4 (category manager) land and
the real-HA validation pass confirms the mechanism.

Everything else in `plans/cards/detailed/10-foundation.md` (the `MinifluxApi`
service layer, `MinifluxStore` cache/refresh bus, UI atoms, virtualized list,
card registration base) is deliberately not built yet — it lands lazily,
unit by unit, starting with `F-U2`.
