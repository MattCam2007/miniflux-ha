# Questions, Issues & Concerns — resolve before implementation

**Purpose:** the gating list. Nothing in the detailed plans should be built until the **Blocking** items here are decided, and each decision should be written back into the referenced plan doc. Items are tagged **[BLOCK]** (decide first), **[SCOPE]** (affects how much we build / release sequencing), or **[TUNE]** (safe to defer, has a sane default).

Each item: the question, why it matters, the options, and a **recommendation** where there is a clear one. Cross-references like `Q3` are used by the other plans.

---

## A. Release & scope — the biggest decisions first

### `S1` **[BLOCK/SCOPE]** — Do we expand the integration's data contract for rich content at all?
**Context:** `STATUS.md` says the integration is *code-complete, fully tested, wire-contract confirmed, at `manifest.json` 0.1.0, not yet released*. Rich content **requires backend changes** — `G5` enclosures, `G6` feed icons, `G7` readability — that touch shipped, 100%-covered code (`models.py`, `normalize.py`, `services.py`, `services.yaml`) and grow the public service response contract. That is real scope expansion on a "done" integration.
**Options:**
- **(a)** Ship 0.1.0 as-is (text-only), build cards against the current contract, and treat `G5/G6/G7` as a fast-follow `0.2.0`. Cards render *text-rich* content now (sanitized HTML body, images already in `content`, reading time, tags) and gain media/icons/full-text in 0.2.
- **(b)** Fold `G5/G6/G7` into the pre-release work so 0.1.0 (or a renamed 0.2.0) ships rich content from day one.
**Recommendation:** **(a)**. The integration is genuinely finishable and releasable now; a lot of "rich" is *already possible* from the shipped `content` HTML (see `S2`). Enclosures/icons/readability are additive and non-breaking, so they slot into 0.2.0 without churn. This also keeps the "never run in real HA yet" gap (`STATUS.md`) from compounding with a big new surface.
**Blocks:** the global build order, and whether `G5/G6/G7` are prerequisites or fast-follows.

### `S2` **[SCOPE]** — How "rich" is the *already-shipped* contract, really?
**Context:** `_entry_to_dict` already returns `content` (full sanitized-by-us HTML) when `include_content:true`. Many feeds embed images and even audio/video `<iframe>`/`<img>` **inside** that HTML. So the RC pipeline's sanitizer + content-view + typography + images (`RC-U1..U5`) deliver meaningful richness **with no backend change**. What the backend gaps add: *structured* media (reliable podcast players, `RC-U6`), feed icons (`RC-U7`), and full-text for teaser feeds (`RC-U8`).
**Decision:** confirm the phasing — RC-U1..U5 (no backend deps) in the first card pass, RC-U6..U8 gated on `G5/G6/G7`. **Recommendation:** yes, phase exactly there.

### `S3` **[BLOCK]** — Build cards on an integration that has never run in a real HA?
**Context:** `STATUS.md`: all 448 tests pass but only against the simulated harness; the integration has never loaded in a genuine HA, and CI (`hassfest`/HACS validation) pass on the branch is unconfirmed. Cards add a *frontend* dimension (static path registration, Lovelace resource, WS `call_service` with `return_response`, admin-only event subscriptions) that the simulated harness exercises weakly.
**Recommendation:** do the `STATUS.md` "first live smoke test" (steps 5–8) **before or in parallel with** `F-U1`, and confirm CI green. The foundation's delivery mechanism (`DC1`) is exactly the kind of thing that only fails on real HA.
**Blocks:** starting `F-U1` with confidence.

### `S4` **[SCOPE]** — Full 9-card suite, or a rich-content MVP first?
**Context:** the stated **goal is rich content in dashboards** (→ F + RC pipeline + C2, plus C1 for at-a-glance). The overview's **minimum bar** is C3 + C4 (all feed/category ops). These are different priorities.
**Options:** (a) rich-content MVP: **F → G5/G6/G7 → RC → C1 → C2**, then reassess; (b) full suite in the documented build order; (c) minimum-bar first (C3/C4) then rich content.
**Recommendation:** **(a)** — it directly serves the user's stated goal and produces a visibly valuable dashboard fastest; C3–C9 follow. Confirm this matches the user's intent, since the earlier planning emphasized the C3/C4 minimum bar.
**Blocks:** what we actually schedule first.

---

## B. Rich-content technical questions

### `Q1` **[BLOCK]** — HTML sanitizer: vendored DOMPurify vs hand-rolled allowlist?
**Context:** `RC-U1` is the `S10` security gate. Hand-rolling an HTML sanitizer that is *actually* safe against mutation-XSS is a well-known footgun.
**Options:** (a) vendor DOMPurify into the bundle (no CDN; ~20KB gz) — battle-tested; (b) hand-rolled allowlist — smaller, but we own the security.
**Recommendation:** **(a) DOMPurify, vendored.** Bundle size is a poor reason to own a security-critical parser. Note the added dependency in the build (`Q10`).
**Blocks:** `RC-U1`.

### `Q2` **[BLOCK]** — Rich embeds (YouTube/Vimeo/Twitter) — support them, and how, under the artifact/HA CSP?
**Context:** `RC-U6` proposes click-to-load, sandboxed, allowlisted-host iframes. But HA dashboards / the frontend have their own CSP (`frame-src`), and third-party embeds are a privacy + security surface.
**Options:** (a) no embeds — strip iframes entirely, link out instead (simplest, safest); (b) click-to-load allowlisted hosts only, sandboxed; (c) full iframe passthrough (rejected — unsafe).
**Recommendation:** **(a) for the first pass** (strip + link-out via `RC-U9`), revisit (b) only if the user specifically wants inline video. Native `audio`/`video` enclosure players (`RC-U6`, non-iframe) are unaffected and still ship.
**Blocks:** scope of `RC-U6`.

### `Q3` **[BLOCK]** — Image & feed-icon delivery: CSP, auth, and privacy.
**Context:** three tangled problems:
1. **CSP `img-src`:** content images come from arbitrary feed hosts. HA's frontend CSP must allow them, or they won't load. Does the target HA config permit third-party `img-src`? (Usually yes for Lovelace, but confirm.)
2. **Feed-icon auth (`G6`):** Miniflux's icon endpoints require the API token. The **frontend must never hold the token**, so a browser `<img src="https://miniflux/v1/feeds/1/icon">` will 401. Icons must come *through the integration* (a service returning a `data:` URI, cached) — this is why `G6` proposes that.
3. **Privacy/referrer:** loading remote images from a dashboard leaks the user's IP + a referrer to every feed's image host. Miniflux itself ships a **media proxy** to avoid exactly this.
**Options:** (a) load content images **direct** with `referrerpolicy=no-referrer`, icons via the `G6` data-URI service; (b) route content images through **Miniflux's media proxy** (rewrite `src` to the proxy URL) for privacy — but the proxy may also need auth/signing; (c) an integration-side image proxy (heavier).
**Recommendation:** **(a)** for icons (data-URI service, mandatory since the browser can't auth) and **(a)** for content images initially with the privacy caveat documented and `show_images` defaulting **on** but toggleable; investigate **(b)** Miniflux media-proxy rewrite as a 0.2.x enhancement.
**Blocks:** `G6`, `RC-U5`, `RC-U7`.

### `Q4` **[TUNE]** — `fetch_original` (`G7`): expose on `get_entries` only, or also `search_entries`?
**Context:** readability fetch hits origin sites and is slow; doing it for a whole `search_entries` page (up to 500) could blow the 30s timeout badly.
**Recommendation:** `get_entries` **only** (per-entry, on demand from the card's "Read full article" — `RC-U8`). Do **not** add it to `search_entries`. Revisit only if a batch use case appears.
**Blocks:** `G7` schema surface.

### `Q5` **[TUNE]** — `G2` per-feed unread: read live counters or join the coordinator snapshot?
**Context:** `get_feeds` is a *live* fetch (`architecture.md §3.3`) but per-feed counters live in the coordinator's polled snapshot. Joining the snapshot is cheap but can be up to one poll interval stale; a live `/v1/feeds/counters` call is fresh but adds a request.
**Recommendation:** **join the snapshot** and label the count as "as of last poll"; the card already re-queries on the poll tick. Cheaper and consistent with how the sensors work.
**Blocks:** `G2` and whether `unread` can ever be `null`.

### `Q6` **[TUNE]** — Podcast playback position: local-only, or write back to Miniflux?
**Context:** `RC-U6` persists audio position in card-local storage and can seed from `G5.media_progression`. Miniflux has an API to *save* media progression per entry.
**Recommendation:** local-only for the first pass (no new mutating service); consider a `set_media_progression` service later if cross-device resume is wanted.
**Blocks:** nothing now; a note on `RC-U6`.

---

## C. Frontend engineering concerns

### `Q7` **[BLOCK]** — Frontend coverage floor.
**Context:** the backend holds 100% branch (one accepted 99%). Card *view* code (Lit templates, DOM) is expensive to push to 100%.
**Recommendation:** **100% for shared runtime** (api, store, sanitizer, pure logic — same bar as backend) and a declared **90% floor for card view code**, enforced in the same `check_coverage_floors.py` spirit. Confirm the number.
**Blocks:** `F-U2` gate config.

### `Q8` **[SCOPE]** — A JS/TS build toolchain in a pure-Python repo.
**Context:** `DC1`/`F-U1` add `frontend/src` (TS + Lit), a bundler (esbuild/rollup), a committed bundle, a bundle-freshness CI check, and a Node dev dependency — into a repo that is currently Python-only with two GitHub workflows (`test.yml`, `validate.yml`).
**Concerns to confirm:** (1) Node in CI; (2) the committed-bundle-matches-source check; (3) does `hassfest`/HACS validation tolerate a `frontend/` dir + committed `.js` inside `custom_components/miniflux/`? (4) `.gitignore` currently ignores JS build artifacts broadly — the committed bundle must be an explicit exception.
**Recommendation:** prototype `F-U1` end-to-end (build + register + load in real HA + CI) as a spike before committing to the whole suite. This is the single riskiest foundation assumption.
**Blocks:** `F-U1`.

### `Q9` **[SCOPE]** — HACS single-category constraint (`DC1`).
**Context:** `DC1` chose to ship cards inside the integration repo (auto-registered Lovelace resource) rather than a companion plugin repo. Confirm this is still preferred vs. a separate `-cards` repo, given the build/CI cost in `Q8`. In-repo means card version == integration version (a feature); separate repo means independent release but version-skew risk.
**Recommendation:** keep in-repo (`DC1`), but the decision rides on `Q8` proving out.

### `Q10` **[TUNE]** — Bundle size budget & dependencies.
**Context:** Lit + DOMPurify (`Q1`) + virtualization; no CDN allowed. Set a budget (e.g. ≤150KB gz) and a rule that any new runtime dep is noted here.
**Recommendation:** adopt a budget; virtualization hand-rolled or a tiny lib, not a heavy grid.

### `Q11` **[TUNE]** — Card strings i18n.
**Context:** the integration ships English-only (`strings.json`/`translations/en.json`). Card UI adds a new pile of strings.
**Recommendation:** English-only for the first pass, but centralize card strings so translation is a later drop-in (don't inline literals across components).

---

## D. Product / UX defaults (mostly [TUNE])

### `Q12` — `show_images` / `show_media` defaults: on or off?
On is richer but costs bandwidth and leaks referrers (`Q3`). **Recommendation:** on by default, prominently toggleable; `autoplay_media` always off.

### `Q13` — `auto_mark_read_on_expand` default (C2).
Expanding to read marks read — convenient but can surprise. **Recommendation:** on (matches most readers), clearly documented, easily disabled.

### `Q14` — Destructive-op hold-to-confirm defaults.
C4 delete defaults `require_hold:true` (cascade); C3 delete defaults `false`. Confirm these match the user's risk appetite.

### `Q15` — Multi-instance (`S7`) — is it a real requirement?
The plans carry per-instance cache/event isolation throughout. If the user only ever has **one** Miniflux, this is dead weight in the first pass (though the foundation should keep the seam). **Recommendation:** build the seam (`config_entry_id` everywhere) but don't invest in multi-instance UX polish until asked.

---

## E. Items already decided upstream (recorded so they're not re-litigated)

- **Replay-able webhooks** — known, documented, mitigated (`STATUS.md`, `architecture.md D1`). Cards treat events as advisory (`DC4`); no card acts on event payloads as truth.
- **No tag-write API / no like-dislike** — stock Miniflux limitation (`architecture.md D5/R3`). Engagement surface = read/star/save only. Cards expose exactly that; no card promises tagging.
- **Custom events admin-only** (`G4`) — not fixable here; every card must be fully functional on entity-tick refresh (`DC4/S9`). Verified in the plans.
- **Caps** (`EVENT_ENTRIES_CAP 50`, `ERROR_FEEDS_ATTR_CAP 25`, `BY_CATEGORY_ATTR_CAP 100`, `SEARCH_LIMIT_MAX 500`, `HYDRATE_IDS_MAX 100`, `UPDATE_IDS_MAX 500`) — cards must *visibly* handle truncation, never silently (`S1`); values live in one place already.

---

## F. Resolution checklist

Before implementation starts, this table should be all-✅:

| ID | Decision needed | Owner | Status |
|---|---|---|---|
| S1 | Rich content in 0.1 vs 0.2 fast-follow | user | ☐ |
| S3 | Real-HA smoke test + CI green first | user | ☐ |
| S4 | Rich-content MVP vs full suite vs minimum-bar-first | user | ☐ |
| Q1 | Sanitizer = DOMPurify vendored | user/eng | ☐ |
| Q2 | Embeds: strip+link-out first | user | ☐ |
| Q3 | Image/icon delivery + privacy stance | user/eng | ☐ |
| Q7 | Frontend coverage floors | eng | ☐ |
| Q8 | JS build toolchain spike proves out | eng | ☐ |
| Q9 | In-repo cards vs companion repo | user/eng | ☐ |

Everything tagged **[TUNE]** can proceed with the recommended default and be revisited during implementation.
