# START HERE — Locked Decisions & Phase 1 Build Plan

**Read this file before any other in this folder.** It is the authoritative source of truth. Where any other document disagrees with this one, **this file wins** — the others are reference detail.

The decisions below are **locked** (agreed with the maintainer). Do not re-open them, do not treat them as options, do not "use your judgment" on them. Just build to them.

---

## 1. Locked decisions

| # | Decision | What it means for you |
|---|---|---|
| **D‑1** | **Minimum bar first.** | Build **only** Phase 1 (below): Foundation → `G2` → C3 feed manager → `G1` → C4 category manager. Do **not** start the reader, search, triage, health, OPML, activity cards, or the rich‑content pipeline. They are Phase 2+, out of scope until Phase 1 ships and is validated. |
| **D‑2** | **Build backend + cards in parallel on the branch; one real‑HA validation pass before any release.** | `G1`/`G2` (integration code) and C3/C4 (cards) are built together on the working branch. Nothing is released until the whole thing has been loaded and smoke‑tested in a **real** Home Assistant. |
| **D‑3** | **Single Miniflux instance only.** | Keep the `config_entry_id` seam in code (every service call carries it), but build **no** multi‑instance UX: no instance picker in card editors, no per‑instance tagging, and **skip the `S7` multi‑instance test matrix**. Cards are zero‑config. Cache stays keyed by `config_entry_id` (cheap, future‑proof) — that is the only multi‑instance concession. |
| **D‑4** | **Destructive‑op friction:** feed delete = confirm dialog; category delete = **hold‑to‑confirm** (it cascades). | C3 `delete_feed`: two‑step confirm showing entry count, `require_hold` default **false**. C4 `delete_category`: two‑step confirm showing feed count, `require_hold` default **true**. Both always show the real blast radius. |
| **D‑5** | **In‑repo delivery, frontend as an isolated subtree.** | The card bundle ships inside this repo (auto‑registered Lovelace resource, `DC1`). All JS/TS lives under a self‑contained `frontend/` subtree with its **own** `package.json`/tsconfig/build — **zero intermingling** with the Python. One HACS install; card version == integration version. |
| **D‑6** | **`G2` unread source = poll snapshot.** | `get_feeds` adds `unread` joined from the coordinator's polled counters snapshot, labeled "as of last poll." Do **not** add a live counters fetch. A feed absent from the snapshot → `unread: 0`. |
| **D‑7** | **`G1` shape.** | New `get_categories` service → `{categories: [{id, title, feed_count, unread}]}`. `feed_count`/`unread` joined from the snapshot where available; unknown → `null` (never an error). Must return **empty** categories (0 feeds) — that is the whole point of `G1`. |
| **D‑8** | **Coverage floors.** | 100% line+branch on shared runtime (api, store, pure logic, `<mf-confirm>` and other atoms' logic) and on all backend (`G1`/`G2`) code — matching the repo's existing bar. 90% floor on card *view* code (C3/C4 templates). Wire into the same coverage‑floor check the repo already runs. |
| **D‑9** | **`F‑U1` is a spike, done first and proven end‑to‑end.** | Before building the rest of the foundation, prove: build emits the bundle → integration registers the static path + Lovelace resource → it loads in a **real** HA → CI (hassfest/HACS + JS build + bundle‑freshness) is green. If the in‑repo delivery mechanism has a problem, find it here, not after 12 units are written. |

**Deferred (Phase 2, do not touch now):** the rich‑content pipeline (`RC‑U*`), the reader (C2), search (C6), triage (C7), health (C5), OPML (C8), activity (C9) cards, and backend gaps `G3` (offset), `G5` (enclosures), `G6` (feed icons), `G7` (readability), `G8` (comments_url). The content‑rendering decisions (sanitizer, images, embeds, readability) are **not yet made** and will be hashed when Phase 2 starts. **Consequence for Phase 1:** C3/C4 show **no feed favicons** (that needs `G6`, deferred) — use a letter/monogram avatar or nothing. C3/C4 render **no entry content** at all; they are management surfaces.

---

## 2. Phase 1 — the exact build order

Build in this order. Each unit is green (tests pass, coverage floors hold) before the next starts. Full per‑unit specs are in the referenced files; the **baked‑in decisions** column tells you what the locked decisions change vs. the reference spec.

| Step | Unit | Spec | Baked‑in decisions (from §1) |
|---|---|---|---|
| 1 | **`F‑U1`** bundle + delivery spike | [10-foundation](./10-foundation.md) | **D‑5** (isolated `frontend/` subtree), **D‑9** (prove in real HA + CI first) |
| 2 | **`F‑U2`** test harness + `FakeHass` | 10-foundation | `FakeHass.user.is_admin` still needed (refresh bus); `is_admin=false` path is the *default* to test (single non‑admin user is common) |
| 3 | **`G2`** per‑feed unread | [02-backend-enabling-gaps](./02-backend-enabling-gaps.md) | **D‑6** (snapshot join, `unread:0` when absent) |
| 4 | **`G1`** `get_categories` | 02-backend-enabling-gaps | **D‑7** (shape; empty categories included) |
| 5 | **`F‑U3`** config‑entry resolution | 10-foundation | **D‑3**: single entry → always auto‑resolve; the "multiple entries" branch is a typed error, not a UX flow |
| 6 | **`F‑U4`** typed service wrappers | 10-foundation | Phase 1 needs wrappers for: `get_feeds` (+`G2` unread), `get_categories` (`G1`), `count_entries`, `create_feed`, `update_feed`, `delete_feed`, `refresh_feed`, `refresh_all_feeds`, `discover_feeds`, `mark_all_read`, `create_category`, `update_category`, `delete_category`. **Skip** the entry query/mutation/content/OPML wrappers (Phase 2). |
| 7 | **`F‑U5`** chunking + error norm + generations | 10-foundation | Phase 1 only needs `update`‑style chunking if used; error‑normalization + request‑generations apply to all calls |
| 8 | **`F‑U6`** cache + keys + isolation | 10-foundation | **D‑3**: keep per‑`config_entry_id` keying (cheap seam); no `S7` cross‑instance test matrix |
| 9 | **`F‑U7`** refresh bus | 10-foundation | **D‑3** single user is typically **non‑admin** → the entity‑tick path (`subscribeEntities`) is the primary signal; the admin event path is a bonus. Test the non‑admin path as the default. |
| 10 | **`F‑U8`** optimistic layer + rollback | 10-foundation | Used by C3 rename (optimistic) and enable/disable; feed/category CRUD stays non‑optimistic (pending + re‑query) |
| 11 | **`F‑U9`** `<mf-confirm>` (+ hold variant) | 10-foundation | **D‑4**: the hold‑to‑confirm variant is required (C4 uses it) |
| 12 | **`F‑U10`** feed + category pickers | 10-foundation | Category picker consumes **`G1`** (built in step 4); inline "new category" via `create_category` |
| 13 | **`F‑U11`** offline / truncation / toast | 10-foundation | — |
| 14 | **`F‑U12`** virtualized list | 10-foundation | Needed for the 500‑feed C3 case (`S1`) |
| 15 | **`F‑U13`** card registration + editor base | 10-foundation | **D‑3**: editor base **hides** the `config_entry_id` picker always (single instance) |
| 16 | **`C3‑U1..U5`** feed manager | [13-feed-manager-card](./13-feed-manager-card.md) | **D‑4** (`require_hold:false` default), **D‑6** (unread badge from `G2`), no favicons (letter avatar) |
| 17 | **`C4‑U1..U4`** category manager | [14-category-manager-card](./14-category-manager-card.md) | **D‑4** (`require_hold:true` default), **D‑7** (empty categories rendered) |
| 18 | **`F‑U14`** bundle smoke + no‑leak | 10-foundation | Assert only C3/C4 + their atoms are exposed; no stray globals; no network at import |
| 19 | **Real‑HA validation** (D‑2/D‑9) | this file §3 | The gate before any release |

> Any foundation atom that only Phase 2 cards use (the RC content atoms, entry‑row/entry‑detail, etc.) is **not** built in Phase 1. Build the foundation **lazily**: only the atoms C3/C4 actually consume.

## 3. Phase 1 "done" gate (real‑HA validation — D‑2)

Phase 1 is complete only when, in a **real** Home Assistant (not the pytest harness):

- [ ] The integration loads; the bundle auto‑registers; C3 and C4 appear in the card picker with zero manual resource setup.
- [ ] C3: create (via discover), read (all feed fields), update (title/category/feed_url/disabled/crawler), delete (confirm + real entry count), refresh, mark‑read, enable/disable — **all reachable, zero gaps.**
- [ ] C4: create, read (**including an empty category**), rename, delete (hold‑to‑confirm + real feed count, cascade warning), mark‑read — **all reachable, zero gaps.**
- [ ] Unread badges (C3) reflect the last poll; a poll tick updates them without a reload.
- [ ] Offline: pull Miniflux, both cards degrade honestly (actions disabled, last‑known data); recover without reload.
- [ ] CI green: hassfest/HACS validation, Python tests + coverage floors, JS build + bundle‑freshness, JS tests + coverage floors.

Only after this gate: cut the release (maintainer's call), then start Phase 2.

## 4. Rules for the implementer (non‑negotiable)

1. **Stay in Phase 1.** If a unit seems to need a Phase 2 card/atom/gap, you have mis‑scoped — re‑read this file. C3/C4 need no entry content and no icons.
2. **Every service call goes through `MinifluxApi`** (F‑U4/U5), never a raw `callService`.
3. **Backend gaps `G1`/`G2` follow the existing pytest TDD process** (`tests/`, `tests/fixtures/synthetic/`, seam rules in `docs/architecture.md §8.4`); Miniflux JSON field names stay confined to `api.py` + `normalize.py`.
4. **Tests first, red→green, coverage floors hold at every commit** (D‑8).
5. **Frontend stays in the isolated `frontend/` subtree** (D‑5); no Node/JS files leak into the Python tree.
6. **When something genuinely isn't specified** and isn't covered by a locked decision, take the documented default in [00-method-and-conventions](./00-method-and-conventions.md) and note it in the commit — do not invent new scope.
