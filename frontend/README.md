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
| `npm run coverage` | Run the suite with coverage instrumentation |
| `npm run check-coverage-floors` | CI guard: enforces D-8's per-file coverage floors (100% runtime, 90% card views) |
| `npm run typecheck` | `tsc --noEmit` |

**After any change under `src/`, run `npm run build` and commit the regenerated bundle.** CI enforces this (`check-bundle-fresh`) — a stale bundle fails the build.

## Current state — Phase 1 complete (F-U1 through F-U14, C3, C4)

Two cards ship from this bundle:

- **`<miniflux-feed-manager-card>`** (`src/cards/feed-manager-card.ts`) — full feed
  CRUD: add via discovery wizard, edit (title/category/feed_url/disabled/crawler),
  delete (confirm + real entry count), refresh/refresh-all, mark-read, enable/disable.
  Grouped-by-category or flat list, monogram avatars (no favicons in Phase 1 — `G6`
  is deferred), G2 unread badges, virtualized past 100 rows.
- **`<miniflux-category-manager-card>`** (`src/cards/category-manager-card.ts`) —
  full category CRUD including **empty categories** (the reason `G1` exists), rename,
  delete (cascade-aware, hold-to-confirm by default — deleting a category deletes its
  feeds), mark-read, drill-in to a category's feed sub-list.

Each card has its own visual editor (`*-card-editor.ts`) built on the shared
`MfCardEditorBase` (`src/cards/mf-card-editor-base.ts`), and both are registered via
the shared `registerCard()` helper (`src/cards/register-card.ts`).

### Layout

- `src/api/` — `MinifluxApi` (one typed method per Phase 1 service), config-entry
  resolution, error normalization. 100% coverage floor.
- `src/store/` — `MinifluxStore`: TTL query cache, refresh bus (admin bus events +
  entity-tick fallback for non-admin users + local mutation notifications), optimistic
  patch/rollback. 100% coverage floor.
- `src/atoms/` — shared UI primitives: `<mf-confirm>` (two-step, hold-to-confirm
  variant), `<mf-feed-picker>`/`<mf-category-picker>` (with inline category create),
  `<mf-offline>`, `<mf-truncation-notice>`, `<mf-toast-host>`, `<mf-virtual-list>`.
  100% coverage floor.
- `src/cards/` — the two cards, their editors, the editor base, and each card's pure
  view-model helpers (grouping/sorting/formatting). 90% coverage floor (view code).
- `src/lib/` — framework-free pure logic (e.g. `GenerationGuard` for dropping stale
  in-flight responses). 100% coverage floor.

### What's deliberately not here

Everything Phase 2 (`00-START-HERE.md` D-1): the reader, search, triage, health,
OPML, and activity cards, the rich-content pipeline, and backend gaps `G3`/`G5`–`G8`.
No entry content is ever rendered by C3/C4 — they are management surfaces only.
