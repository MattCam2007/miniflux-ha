# Detailed Implementation Plans — Rich RSS Content Dashboards

**Status:** Detailed, implementation-ready plans (input to a TDD build pass)
**Parent:** the high-level card plans in [`../`](../) — read [`../00-overview.md`](../00-overview.md) first for architecture, decisions, and the coverage matrix.
**Goal (user requirement):** *rich RSS content in dashboards* — not just count sensors and lists, but readable articles, images, podcast/video media, feed identity, and full-text — all reachable and good-looking inside Home Assistant Lovelace.

---

> **⚠ Read [`00-START-HERE.md`](./00-START-HERE.md) first.** It carries the **locked decisions** and the exact **Phase 1 build order**, and it overrides every other document where they disagree. A simpler model is doing the implementation; that file is written to be followed literally.

## What these documents are

The high-level plans in `../` fix each card's *purpose, surface, layout, and acceptance criteria* and deliberately defer per-card TDD chunking to "pickup." **This folder is that pickup.** Every card and shared component is broken into **individual, testable units of work** — each unit is a self-contained, red-green-refactor increment with its own test list and Definition of Done.

Each document also carries **usage documentation** ("How to use this card") so that the moment a card is built it is also documented for dashboard authors.

Before any of this is implemented, the open decisions in **[`QUESTIONS-ISSUES-CONCERNS.md`](./QUESTIONS-ISSUES-CONCERNS.md)** must be resolved — that is the gating list the user asked for.

## The rich-content framing (why this is not just "the card suite")

The shipped integration exposes entries as **text**: `_entry_to_dict` in `services.py` serializes `title, url, author, published_at, reading_time, tags, content(HTML)` and nothing else. That is enough for a *reading list*; it is **not** enough for *rich RSS content*. Three things that make RSS rich are currently dropped at the integration boundary and must be added as backend units before the cards that render them:

- **Enclosures** — podcast audio, video, images/thumbnails (`G5`).
- **Feed icons / favicons** — visual feed identity (`G6`).
- **Readability full-text** (`fetch_original`) — designed in `architecture.md §3.3`, never shipped in `services.yaml` (`G7`).

These, plus the previously-identified `G1`–`G4`, are specified as backend TDD units in **[`02-backend-enabling-gaps.md`](./02-backend-enabling-gaps.md)**, and the rich-content rendering that consumes them is specified in **[`01-rich-content-pipeline.md`](./01-rich-content-pipeline.md)** — the centerpiece of this plan.

---

## Document index

| Doc | Scope |
|---|---|
| [`00-method-and-conventions.md`](./00-method-and-conventions.md) | The unit-of-work format, the frontend test harness, the shared Definition of Done, sanitization/accessibility baselines, how backend gap-units interleave with card-units |
| [`01-rich-content-pipeline.md`](./01-rich-content-pipeline.md) | **Centerpiece.** The content-rendering pipeline: sanitizer → `<mf-content-view>` → media (audio/video/image/gallery) → images/lazy-load → readability → typography/theme/RTL. Units RC-U1…RC-U12 |
| [`02-backend-enabling-gaps.md`](./02-backend-enabling-gaps.md) | `G1`–`G8` as backend TDD units (the enablers). Each says what changes, which files, which tests, and which card it unblocks |
| [`10-foundation.md`](./10-foundation.md) | **F** — delivery, `MinifluxApi`, `MinifluxStore`, UI atoms, editor base, card registration. Units F-U1…F-U14 |
| [`11-status-card.md`](./11-status-card.md) | **C1** units + usage |
| [`12-reader-card.md`](./12-reader-card.md) | **C2** the flagship rich-reading surface — units + usage |
| [`13-feed-manager-card.md`](./13-feed-manager-card.md) | **C3** units + usage |
| [`14-category-manager-card.md`](./14-category-manager-card.md) | **C4** units + usage |
| [`15-health-card.md`](./15-health-card.md) | **C5** units + usage |
| [`16-search-card.md`](./16-search-card.md) | **C6** units + usage |
| [`17-triage-card.md`](./17-triage-card.md) | **C7** units + usage |
| [`18-opml-card.md`](./18-opml-card.md) | **C8** units + usage |
| [`19-activity-card.md`](./19-activity-card.md) | **C9** units + usage |
| [`QUESTIONS-ISSUES-CONCERNS.md`](./QUESTIONS-ISSUES-CONCERNS.md) | **Resolve before implementation.** Open decisions, risks, and things that need the user's call |

## Global build order — phased (decisions locked, see `00-START-HERE.md`)

The maintainer chose **minimum bar first**: the feed and category management cards ship before the rich reading surface. Build **Phase 1 only** until it is validated in a real HA and released.

**Phase 1 — minimum bar (the current work):**
```
F-U1  →  F-U2  →  G2  →  G1  →  F-U3…F-U13 (lazily, only atoms C3/C4 use)  →  C3  →  C4  →  F-U14  →  real-HA validation
```
Phase 1 needs backend gaps **`G1`** and **`G2`** only, and **no** rich-content pipeline (C3/C4 render no entry content and — per the deferral of `G6` — no feed favicons yet). See [`00-START-HERE.md §2`](./00-START-HERE.md) for the step-by-step table with baked-in decisions.

**Phase 2+ — rich content & the rest (deferred, not yet scheduled):**
```
G5, G6, G7  →  RC-U1…RC-U12  →  C1  →  C2  →  C5  →  (G3) C6  →  C7  →  C8  →  C9
```
The content-rendering decisions (sanitizer, images, embeds, readability) are **not yet made** — they get hashed when Phase 2 starts.

`G4` (custom events admin-only) is not a build unit — it is a documented constraint that shapes the refresh design (foundation F-U7); with a single non-admin user (the common case) the entity-tick path is the primary refresh signal. `G8` (comments_url) is optional Phase 2 polish.

## How to read a unit

Every unit follows the anatomy defined in [`00-method-and-conventions.md`](./00-method-and-conventions.md): an ID, dependencies, a one-line deliverable, a behavior spec, an explicit **Tests** list (the red-green target), and a **Definition of Done** checklist. A unit is "individually testable" by construction: if you cannot write its Tests list without depending on an unbuilt unit, it is mis-scoped and must be split.
