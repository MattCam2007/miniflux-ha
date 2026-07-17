# Rich Content Pipeline — Units RC-U1 … RC-U12

**This is the centerpiece of the "rich RSS content" goal.** Everything else in the suite is plumbing and management; this is the part that turns a Miniflux entry into something worth looking at on a dashboard. It is built as a set of shared components (living in the foundation bundle) that C2 (reader) and C7 (triage) compose, and that C6 (search) reuses for row expansion.

**Depends on backend enablers** `G5` (enclosures), `G6` (feed icons), `G7` (readability) — see [`02-backend-enabling-gaps.md`](./02-backend-enabling-gaps.md). RC-U1…U4 need none of them and can start immediately after `F-U1/F-U2`.

**Inherited baselines** (from [`00-method-and-conventions.md`](./00-method-and-conventions.md)): sanitization §5, accessibility §6, theme §7. Not restated per unit.

---

## What "rich" means here (the target)

A rendered entry should carry, when the data exists: a **feed icon + name**, **title**, **author · reading-time · relative age · category**, **tags**, a **lead image/thumbnail**, the **sanitized article body** with working inline images, **media** (an inline audio player for podcasts, a click-to-load video/embed), an **enclosure/attachment list**, a **"read full article" (readability) toggle**, and link-outs (**open original ↗**, **discuss ↗**). All theme-aware, all sanitized, all degrading gracefully when a field is absent or Miniflux is offline.

---

## Layer A — sanitize & render body (no backend deps)

### `RC-U1` — HTML sanitizer (pure)
**Depends on:** F-U2 (test harness)
**Deliverable:** `frontend/src/content/sanitize.ts` — `sanitize(html: string, opts): SafeFragment`.
**Behavior:**
- Allowlist tags (`p,br,h1..h6,ul,ol,li,blockquote,pre,code,em,strong,b,i,a,img,figure,figcaption,table,thead,tbody,tr,td,th,hr,sub,sup,span,div`) and attributes (`href,src,alt,title,colspan,rowspan,srcset,width,height`). Everything else dropped, contents kept where sensible.
- Strip `<script>,<style>,<iframe>` (embeds handled separately in RC-U6), event handlers (`on*`), `javascript:`/`vbscript:`/non-image `data:` URLs.
- Rewrite `<a>` to `target=_blank rel="noopener noreferrer nofollow"`.
- Defer image loading (`loading=lazy`, `decoding=async`) and hand image nodes to RC-U5's policy.
- Decision to fix: hand-rolled allowlist vs vendored DOMPurify (bundle-size vs rigor) — **Q1**. Default recommendation: DOMPurify (vendored, no CDN), because getting sanitization *rigorously* right by hand is a security liability the suite shouldn't own.
**Tests (pure ring — the security core):**
- `<script>alert(1)</script>` removed; `<img src=x onerror=alert(1)>` → onerror stripped.
- `<a href="javascript:…">` neutralized; `<a href="https://…">` gets `rel`/`target`.
- `<iframe src=evil>` removed; allowlisted-host iframe deferred to RC-U6, not emitted here.
- Nested/mismatched/broken HTML doesn't throw and doesn't leak raw markup.
- 10k-char text node preserved as text (no truncation at this layer — CSS clamps).
- Table/figure structure preserved.
**DoD:** this is the `S10` gate; fuzz a corpus of known XSS vectors.

### `RC-U2` — `<mf-content-view>` element
**Depends on:** RC-U1
**Deliverable:** `frontend/src/content/mf-content-view.ts` — Lit element taking `.html` and `.options`, rendering sanitized content into shadow DOM.
**Behavior:** mounts the `SafeFragment`; applies the reading typography stylesheet (RC-U3); exposes `show_images`, `max_height`/expandable, and a "content is empty/teaser" signal. No raw string ever hits `innerHTML` outside the sanitizer.
**Tests (component ring):** given HTML → sanitized nodes present; `show_images:false` → images replaced by a placeholder chip; empty content → the empty-state slot; re-render on `.html` change doesn't duplicate nodes.

### `RC-U3` — Reading typography & theme stylesheet
**Depends on:** RC-U2
**Deliverable:** `frontend/src/content/reading.css.ts` (Lit `css`).
**Behavior:** readable measure (max ~70ch), fluid type scale, spaced paragraphs/lists/blockquotes, styled `pre`/`code` with horizontal scroll, responsive `img{max-width:100%}`, figure/caption styling — all via HA CSS vars so light/dark both work; honor `prefers-reduced-motion`.
**Tests:** snapshot the applied classes for h/p/pre/blockquote; assert no hard-coded hex; assert `pre` gets `overflow-x:auto`; RTL (`dir=rtl`) mirrors padding/alignment.

### `RC-U4` — Content metadata header (`<mf-entry-meta>`)
**Depends on:** F-U4 (time/format helpers)
**Deliverable:** author · reading-time · relative published age · category chip · tag chips, as a compact reusable header.
**Behavior:** omit absent fields cleanly (no "by " with empty author); relative age auto-updates on the poll tick; tags overflow to "+N"; reading-time hidden when 0.
**Tests:** missing author omitted; `reading_time:0` hidden; 12 tags → chips + "+N"; age string from a fixed clock; category chip absent when `category_title` null.

---

## Layer B — media & images (needs backend enablers)

### `RC-U5` — Images: lazy-load, lead image, placeholder policy
**Depends on:** RC-U2, RC-U1; benefits from `G5` (enclosure images)
**Deliverable:** image handling inside `<mf-content-view>` + a `leadImage(entry)` selector.
**Behavior:**
- All body images `loading=lazy decoding=async`, broken-image → graceful placeholder (no broken-icon).
- **Lead image / thumbnail** selection order: first image enclosure (`G5`) → first content `<img>` above the fold → none. Exposed so list rows (C2) can show a thumbnail without hydrating full content when an enclosure exists.
- `show_images` config gates *all* remote image loads (privacy); when off, a one-tap "load images" reveal.
- **Referrer/privacy** and whether to route images through an integration image-proxy is **Q3** (Miniflux has a media proxy; the CSP forbids arbitrary hosts). Until resolved, images load direct with `referrerpolicy=no-referrer` and the concern is documented.
**Tests (pure + component):** classifier picks image enclosure as lead; falls back to first content img; `show_images:false` blocks `src` (uses `data-src`) and shows reveal; broken image → placeholder; no-lead entry → no thumbnail slot.

### `RC-U6` — Media players: audio (podcast), video, safe embeds
**Depends on:** `G5`, RC-U2
**Deliverable:** `<mf-enclosure-player>` — renders one enclosure by kind.
**Behavior:**
- Enclosure **classifier** (pure): `audio/*` → inline `<audio controls preload=none>`; `video/*` → `<video controls preload=none poster=lead>`; `image/*` → figure (or gallery in RC-U10); other → download chip with type+size.
- Podcast affordance: audio player shows title + feed icon; **playback position** persists per entry-id in card-local storage (and, if `G5.media_progression` is present, seeds from it) — a wall tablet can resume an episode.
- Embeds (YouTube/Vimeo etc.): **click-to-load only**, into an allowlisted-host sandboxed iframe (`sandbox="allow-scripts allow-same-origin allow-presentation"`), never auto-embedded, never from arbitrary hosts. Allowlist + Q2 (do we even want embeds, given CSP `frame-src`?).
- Enclosure **list**: when >1 or when the player isn't the primary content, show an attachments list (icon, type, human size, open/download).
**Tests:** classifier maps mime→kind incl. `audio/mpeg`, `video/mp4`, `image/jpeg`, `application/pdf`→download; audio element `preload=none` (no autoplay, no eager fetch); position save/restore round-trip with fake storage; embed not present until clicked; non-allowlisted embed host → download chip fallback, no iframe.

### `RC-U7` — Feed identity (icon + name)
**Depends on:** `G6`, F-U3 (store/cache)
**Deliverable:** `<mf-feed-badge>` — feed icon + title, used in list rows, content header, C3/C5.
**Behavior:** icon fetched once per feed via the `G6` path, cached with long TTL in the store, shared across all cards; fallback to a monogram/letter avatar when no icon; never blocks first paint (icon fills in async).
**Tests:** icon requested once for N rows of the same feed (dedup via store); missing icon → monogram; icon cache survives a re-render; offline → last-known icon or monogram, no spinner.

---

## Layer C — full text, links, galleries

### `RC-U8` — Readability full-text toggle
**Depends on:** `G7`, RC-U2
**Deliverable:** a "Read full article" control on `<mf-content-view>` when content looks like a teaser.
**Behavior:** detects likely-truncated content (short body + trailing "read more"/ellipsis heuristic, or always-available control per config); on tap calls `get_entries {fetch_original:true}` for that one id, swaps in readability content, caches it, shows a spinner then result; failure falls back to feed content with a toast (`G7` guarantees no hard error). Distinguishes "showing feed content" vs "showing full article" visibly.
**Tests:** teaser heuristic true/false cases; tap → single `get_entries fetch_original` call for the id; success swaps content and caches (second tap no re-call); failure keeps feed content + toast; the "full article" badge toggles.

### `RC-U9` — Link-outs
**Depends on:** RC-U4; `G8` for discuss link
**Deliverable:** "Open original ↗" (always, from `entry.url`) and "Discuss ↗" (when `comments_url`, `G8`).
**Behavior:** `window.open(url, '_blank', 'noopener')`; never navigates the dashboard; discuss hidden when no `comments_url`.
**Tests:** open uses `entry.url` and a new context; discuss present iff `comments_url`; no dashboard navigation side effect.

### `RC-U10` — Image gallery (multi-image entries)
**Depends on:** RC-U5, `G5`
**Deliverable:** a lightweight gallery for entries with multiple image enclosures / many content images.
**Behavior:** thumbnails strip → tap opens an in-card lightbox (focus-trapped, ESC/backdrop close, arrow keys), lazy, no external lib. Optional per card config (`gallery: true`).
**Tests:** N image enclosures → N thumbnails; open/next/prev/close by keyboard; focus returns to opener on close; reduced-motion disables transitions.

---

## Layer D — packaging the pipeline for cards

### `RC-U11` — `<mf-entry-detail>` composite
**Depends on:** RC-U2..RC-U9
**Deliverable:** the full "expanded entry" view = feed badge + meta header + lead media + content-view + readability toggle + enclosure list + link-outs + action bar slot.
**Behavior:** one element C2/C7/C6 drop in; takes an `Entry` (hydrated or not) and a hydrate callback; renders progressively (metadata instantly from the list row, body after `get_entries`); an action-bar `<slot>` so each card supplies its own verbs (star/read/remove/triage) without this element knowing them.
**Tests:** renders from an un-hydrated entry (meta only) then upgrades on hydration; action slot projects card-supplied buttons; offline → content-view shows last-known or "content unavailable offline", actions disabled via the host card.

### `RC-U12` — `<mf-entry-row>` (rich list row)
**Depends on:** RC-U7, RC-U5 (lead thumb), RC-U4
**Deliverable:** the compact list row used by C2/C6/C7 queues: feed icon, title (2-line clamp), meta line, optional thumbnail, read/star state, action icons, media/attachment indicator (🎧/🎬/🖼 from enclosures without hydrating, thanks to `G5` being included even when `include_content=false`).
**Behavior:** thumbnail only when a cheap lead image exists; media badge from enclosure metadata; virtualization-friendly (fixed-ish height, no layout thrash); sanitized title as text.
**Tests:** enclosure audio → 🎧 badge with no content hydration; title clamps by CSS at 2 lines; unread dot + star reflect state; thumbnail present iff lead image; row height stable for the virtualizer (C2-U*).

---

## Pipeline acceptance (roll-up)

- A podcast entry renders an inline, resumable audio player; a video entry a click-to-load poster; an image-heavy entry a gallery — all sanitized, all theme-aware.
- A teaser-only feed entry offers "Read full article" and produces real full text via `G7`.
- Feed icons appear across list rows, content headers, and management cards, fetched once and cached.
- Every XSS vector in the RC-U1 corpus is neutralized; no external network request except allowlisted images/media/embeds the user's config permits.
- With Miniflux offline, previously-rendered content stays; new hydration/media/readability calls degrade to honest offline states, never spinners forever.

## How dashboard authors control rich content (usage)

These options are surfaced by C2/C7 (and documented in their usage sections); the pipeline honors them:

```yaml
# (excerpt — full options live in each card's usage doc)
show_images: true            # load remote images in content (privacy toggle)
show_media: true             # render audio/video players and enclosure list
autoplay_media: false        # never true by default; audio/video preload=none regardless
readability: on_demand       # off | on_demand | always  (full-text via fetch_original, G7)
gallery: true                # in-card lightbox for multi-image entries
embeds: click_to_load        # off | click_to_load  (allowlisted hosts only; see Q2)
show_feed_icons: true        # feed favicons (G6)
```
