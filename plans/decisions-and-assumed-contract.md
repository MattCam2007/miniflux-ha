# Locked Decisions & Assumed Miniflux Contract

**Purpose:** unblock building **without** the R1 checklist. Every Miniflux wire detail below is a best-guess coded into `const.py` (+ `normalize.py`/`api.py`). In the morning, run [`r1-contract-pinning.md`](./r1-contract-pinning.md) and **diff its results against this file** — because all wire knowledge is confined to those modules, any correction is a one-file edit, not a rewrite.

**Confidence:** target instance is **latest Miniflux**, so the values below are High-confidence unless flagged. Treat 🟡 items as the most likely to need a morning fix.

**Update (2026-07-16) — R1 checklist run, reconciled:** Sections A, B, and C all ran against the real instance (Miniflux **2.3.2**, confirmed via the webhook delivery's `User-Agent` header). Almost every guess below was exactly right — REST auth/endpoints/field names, both webhook header names, both event-type values, and all five tested mutation endpoints (all returned `204`, all already handled correctly by `api.py`). Rows below are updated in place to `Confirmed` where the checklist proved them; two genuinely remain open (see the watch-list at the bottom) — `published_after`/`published_before` were never exercised, and the webhook **signature encoding** is strongly supported (captured signatures are valid 64-hex-char SHA-256-length digests) but not yet an exact-match confirmation, because the one verification attempt used the Miniflux **API key** instead of the actual Miniflux-generated **webhook secret** — an easy re-run, not a wire-contract surprise. One real bug the exercise surfaced and fixed: `api.get_version()` could have raised an uncaught `JSONDecodeError` and crashed entry setup if `/v1/version` were ever absent *and* `/version`'s fallback redirected to non-JSON content (this instance's own bare `/version` returns a 302, confirming the redirect behavior is real) — hardened in `api.py`, covered by two new tests.

---

## Locked decisions (this session)

| Item | Decision |
|---|---|
| License | **MIT** (`LICENSE` added; holder `MattCam2007` — change to your name if you want). |
| HA minimum version | **2025.6.0** (`manifest.json` + `hacs.json` + CI). |
| R3 — tags / engagement | **CLOSED. No tag features, ever.** Engagement surface is `starred` (queryable + settable) + the `save_entry` event. Do not resurface tags in any later phase. |
| R6 — ai_task chunking/prompts | **Best-effort docs only** (consumer-side, in `docs/setup.md` examples). Changeable anytime; not integration code. |
| R2 / R4 — webhook delivery semantics / save_entry UX | Safe by design (events are best-effort accelerators). No action. |
| Miniflux ↔ HA connectivity | **User's responsibility, out of scope** for the integration. |
| Miniflux version | **Latest** → `/v1/feeds/counters` and `/v1/version` assumed present. |

## Build-on-guesses protocol

1. Code against the constants below (single source: `const.py`).
2. Every guessed value gets a `# ASSUMED (R1) — verify` marker in code.
3. Morning: run the checklist, fill its report, then edit `const.py`/`normalize.py` field maps + regenerate `tests/fixtures/`. Tests that encode a wrong guess flip red → fix the constant → green. That's the whole reconciliation.

---

## Assumed contract — auth & REST endpoints

Base URL may include a sub-path; all paths append under it. Auth header on **every** request.

| Purpose | Method + path | Assumption | Conf |
|---|---|---|---|
| Auth | header `X-Auth-Token: <api_key>` | API-key header (Basic auth also supported, not used) | **Confirmed** (smoke test) |
| Identity | `GET /v1/me` | returns user obj incl. `id`, `username` | **Confirmed** |
| Version | `GET /v1/version` | JSON `{version, commit, ...}`; fall back to `GET /version` if 404 | **Confirmed present** (200, real content); root fallback path itself unexercised (v1 never 404s here) — bare `/version` 302-redirects rather than 404ing, which is why `get_version()` was hardened against a redirect landing on non-JSON |
| Feeds | `GET /v1/feeds` | array of feed objects (fields below) | **Confirmed** |
| Counters | `GET /v1/feeds/counters` | `{"reads":{id:n}, "unreads":{id:n}}` | **Confirmed** (keyed by string ids, as expected) |
| Categories | `GET /v1/categories` | array `{id,title,user_id,hide_globally}` | **Confirmed** |
| Entries (global) | `GET /v1/entries` | `{"total":N, "entries":[...]}` | **Confirmed** (`total` present) |
| Entries (scoped) | `GET /v1/feeds/{id}/entries`, `GET /v1/categories/{id}/entries` | same envelope | N/A — `api.py` deliberately has no separate scoped-endpoint methods; `feed_id`/`category_id` are query params against the global `/v1/entries` instead (plans/03-api-client.md's resolution note) |
| Single entry | `GET /v1/entries/{id}` | entry object | High (exercised indirectly via B4's scratch-feed entry lookup) |
| Full-text scrape | `GET /v1/entries/{id}/fetch-content` | `{"content":"..."}` | High (unexercised — `fetch_original` remains an unimplemented tracked gap, plans/03-api-client.md) |
| Bulk status | `PUT /v1/entries` body `{"entry_ids":[..],"status":"read|unread|removed"}` | 204 on success | **Confirmed** (204, both directions) |
| Star toggle | `PUT /v1/entries/{id}/bookmark` | **toggles** starred; 204 | **Confirmed** (204, both toggles) |
| Mark all read | `PUT /v1/feeds/{id}/mark-all-as-read`, `/v1/categories/{id}/mark-all-as-read`, `/v1/users/{id}/mark-all-as-read` | 204 | **Confirmed** for the feed-scoped path (204); category/user-scoped paths unexercised but same shape |
| Refresh | `PUT /v1/feeds/{id}/refresh`, `PUT /v1/feeds/refresh` (all) | 204 | **Confirmed** for single-feed refresh (204); all-feeds variant unexercised |
| Feed CRUD | `POST /v1/feeds` `{"feed_url","category_id","crawler",...}`→`{"feed_id":N}`; `PUT /v1/feeds/{id}`; `DELETE /v1/feeds/{id}` | | `DELETE` **confirmed** (204); create/update unexercised |
| Category CRUD | `POST /v1/categories` `{"title"}`; `PUT /v1/categories/{id}`; `DELETE /v1/categories/{id}` | | High (unexercised) |
| Discover | `POST /v1/discover` `{"url"}` → array | | High (unexercised) |
| OPML | `GET /v1/export` (XML text); `POST /v1/import` (XML body) | | High (unexercised) |

### Entries query params (for `filters.to_query_params`, chunk 1.4)

| Filter field | Miniflux param | Notes | Conf |
|---|---|---|---|
| status (repeatable) | `status=unread&status=read` | values `unread|read|removed` | **Confirmed** (`status=unread` tested) |
| starred | `starred=true` | | **Confirmed** (tested, filtered correctly) |
| free text | `search=<q>` | | **Confirmed** (tested, filtered correctly) |
| category id | `category_id=<id>` | | High (unexercised directly, but real entries carry `category_id`/`category` shapes matching `filters.py`'s expectations) |
| feed id | `feed_id=<id>` | | High (unexercised directly) |
| published lower bound | `published_after=<unix_seconds>` | integer epoch seconds | 🟡 **STILL OPEN** — Section A didn't exercise a date-range filter |
| published upper bound | `published_before=<unix_seconds>` | integer epoch seconds | 🟡 **STILL OPEN** — same as above |
| limit / offset | `limit`, `offset` | pagination (D7 walks these) | **Confirmed** (`entries_unread.json` returned `total:700` against `limit=1`, consistent with pagination working) |
| order / direction | `order=published_at`, `direction=desc` | | High (unexercised directly) |

## Assumed contract — object fields

**Feed** (`normalize.feed_from_json`, chunk 1.3): `id`, `title`, `feed_url`, `site_url`, `checked_at` (RFC3339), `parsing_error_count` (int), `parsing_error_message` (str), `disabled` (bool), nested `category:{id,title}`. **Confirmed** — every field present in real `feeds.json`/entry-embedded feed objects, exact names.

**Entry** (`normalize.entry_from_json`, chunk 1.3): `id`, `feed_id`, `status` (`unread|read|removed`), `title`, `url`, `author`, `content` (HTML), `starred` (bool), `reading_time` (int min), `published_at`/`changed_at`/`created_at` (RFC3339), `hash`, `tags` (list[str]), nested `feed:{...,category:{id,title}}`. **Confirmed** for REST-sourced entries (`entries_unread.json`) and webhook `save_entry`'s nested `entry` object — both carry the full nested `feed`. **One real nuance found:** webhook `new_entries`' per-entry objects (inside the `entries` array) do **not** carry a nested `feed` at all — only the envelope's top-level `feed` key does. This is harmless in practice: `webhook_payload._project_new_entries` reads feed/category info from the envelope's top-level `feed` directly (matching real data exactly), and the per-entry `Entry.feed_title`/`category_id`/`category_title` that come back blank for that path are never read — `EntryCompact.from_entry` (what actually reaches the bus) only carries `id`/`feed_id`/`title`/`url`/`published_at`/`author`. No code change needed, but worth recording since it's a real, confirmed shape difference from the REST path, not an assumption.

## Assumed contract — webhook (the load-bearing guess)

| Aspect | Assumption | Conf |
|---|---|---|
| Signature header | `X-Miniflux-Signature` | **Confirmed** — exact match, both captured deliveries |
| Event-type header | `X-Miniflux-Event-Type` | **Confirmed** — exact match, values `new_entries`/`save_entry` also match the body's own redundant top-level `event_type` field |
| Signature scheme | **hex-encoded HMAC-SHA256 over the raw request body**, keyed by the Miniflux-generated secret | 🟡 **STRONGLY SUPPORTED, NOT YET CLOSED** — captured signatures are 64 hex characters (correct length/encoding for a SHA-256 digest), but the one verification attempt used the Miniflux API key instead of the real webhook secret, so no exact-match confirmation yet. Re-run checklist Section B4 with the actual secret (Miniflux → Settings → Integrations → Webhook page) to close this. |
| Event types | `new_entries`, `save_entry` | **Confirmed** |
| `new_entries` body | `{"event_type":"new_entries","feed":{feed obj},"entries":[entry objs...]}` | **Confirmed** — exact shape, including nested `feed.category:{id,title}` |
| `save_entry` body | `{"event_type":"save_entry","entry":{entry obj}}` | **Confirmed** — exact shape, entry carries its own nested `feed` (see object-fields note above) |
| Content-Type | `application/json` | **Confirmed** |

`signature.py` (chunk 1.5) and `webhook_payload.py` (chunk 1.6) match real captured data exactly on everything except the one item above.

---

## Morning watch-list — status after the R1 run

1. ~~Signature encoding hex vs base64~~ — strongly supported (right length/format), pending an exact-match re-test with the correct webhook secret (see webhook table above). Everything else on the original list is now confirmed:
2. ~~Signature/event-type header names~~ — **confirmed exact.**
3. ~~`/v1/version` path presence~~ — **confirmed present**; `api.get_version()` was additionally hardened against the real `/version` redirect-to-non-JSON behavior this run surfaced (see `api.py`, two new tests in `test_api.py`).
4. ~~Entry `tags` + category nesting shape~~ — **confirmed**, plus the `new_entries`-per-entry-has-no-nested-feed nuance documented above.

**Still genuinely open:**
- **`published_after`/`published_before` param name + unit** — never exercised; still exactly the original guess.
- **Webhook signature exact-match** — needs a B4 re-run with the real secret (see above). This is the only item standing between "R1 closed" and this file being fully retired.

Once the signature re-test lands, every `# ASSUMED (R1)` marker in `const.py` should either flip to a confirmed comment (as most already have) or move to the two rows above.
