# Locked Decisions & Assumed Miniflux Contract

**Purpose:** unblock building **without** the R1 checklist. Every Miniflux wire detail below is a best-guess coded into `const.py` (+ `normalize.py`/`api.py`). In the morning, run [`r1-contract-pinning.md`](./r1-contract-pinning.md) and **diff its results against this file** — because all wire knowledge is confined to those modules, any correction is a one-file edit, not a rewrite.

**Confidence:** target instance is **latest Miniflux**, so the values below are High-confidence unless flagged. Treat 🟡 items as the most likely to need a morning fix.

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
| Auth | header `X-Auth-Token: <api_key>` | API-key header (Basic auth also supported, not used) | High |
| Identity | `GET /v1/me` | returns user obj incl. `id`, `username` | High |
| Version | `GET /v1/version` | JSON `{version, commit, ...}`; fall back to `GET /version` if 404 | 🟡 |
| Feeds | `GET /v1/feeds` | array of feed objects (fields below) | High |
| Counters | `GET /v1/feeds/counters` | `{"reads":{id:n}, "unreads":{id:n}}` | High |
| Categories | `GET /v1/categories` | array `{id,title,user_id,hide_globally}` | High |
| Entries (global) | `GET /v1/entries` | `{"total":N, "entries":[...]}` | High |
| Entries (scoped) | `GET /v1/feeds/{id}/entries`, `GET /v1/categories/{id}/entries` | same envelope | High |
| Single entry | `GET /v1/entries/{id}` | entry object | High |
| Full-text scrape | `GET /v1/entries/{id}/fetch-content` | `{"content":"..."}` | High |
| Bulk status | `PUT /v1/entries` body `{"entry_ids":[..],"status":"read|unread|removed"}` | 204 on success | High |
| Star toggle | `PUT /v1/entries/{id}/bookmark` | **toggles** starred; 204 | High |
| Mark all read | `PUT /v1/feeds/{id}/mark-all-as-read`, `/v1/categories/{id}/mark-all-as-read`, `/v1/users/{id}/mark-all-as-read` | 204 | High |
| Refresh | `PUT /v1/feeds/{id}/refresh`, `PUT /v1/feeds/refresh` (all) | 204 | High |
| Feed CRUD | `POST /v1/feeds` `{"feed_url","category_id","crawler",...}`→`{"feed_id":N}`; `PUT /v1/feeds/{id}`; `DELETE /v1/feeds/{id}` | | High |
| Category CRUD | `POST /v1/categories` `{"title"}`; `PUT /v1/categories/{id}`; `DELETE /v1/categories/{id}` | | High |
| Discover | `POST /v1/discover` `{"url"}` → array | | High |
| OPML | `GET /v1/export` (XML text); `POST /v1/import` (XML body) | | High |

### Entries query params (for `filters.to_query_params`, chunk 1.4)

| Filter field | Miniflux param | Notes | Conf |
|---|---|---|---|
| status (repeatable) | `status=unread&status=read` | values `unread|read|removed` | High |
| starred | `starred=true` | | High |
| free text | `search=<q>` | | High |
| category id | `category_id=<id>` | | High |
| feed id | `feed_id=<id>` | | High |
| published lower bound | `published_after=<unix_seconds>` | integer epoch seconds | 🟡 |
| published upper bound | `published_before=<unix_seconds>` | integer epoch seconds | 🟡 |
| limit / offset | `limit`, `offset` | pagination (D7 walks these) | High |
| order / direction | `order=published_at`, `direction=desc` | | High |

## Assumed contract — object fields

**Feed** (`normalize.feed_from_json`, chunk 1.3): `id`, `title`, `feed_url`, `site_url`, `checked_at` (RFC3339), `parsing_error_count` (int), `parsing_error_message` (str), `disabled` (bool), nested `category:{id,title}`. High confidence.

**Entry** (`normalize.entry_from_json`, chunk 1.3): `id`, `feed_id`, `status` (`unread|read|removed`), `title`, `url`, `author`, `content` (HTML), `starred` (bool), `reading_time` (int min), `published_at`/`changed_at`/`created_at` (RFC3339), `hash`, `tags` (list[str]), nested `feed:{...,category:{id,title}}`. **Category comes via `entry.feed.category`.** 🟡 confirm `tags` present and category nesting depth.

## Assumed contract — webhook (the load-bearing guess)

| Aspect | Assumption | Conf |
|---|---|---|
| Signature header | `X-Miniflux-Signature` | High |
| Event-type header | `X-Miniflux-Event-Type` | High |
| Signature scheme | **hex-encoded HMAC-SHA256 over the raw request body**, keyed by the Miniflux-generated secret | 🟡 High — verify hex vs base64 |
| Event types | `new_entries`, `save_entry` | High |
| `new_entries` body | `{"event_type":"new_entries","feed":{feed obj},"entries":[entry objs...]}` | High |
| `save_entry` body | `{"event_type":"save_entry","entry":{entry obj}}` | High |
| Content-Type | `application/json` | High |

`signature.py` (chunk 1.5) and `webhook_payload.py` (chunk 1.6) are written to these. The single 🟡 that would force a real change is the signature **encoding** — if the morning check shows base64, it's a one-line swap in `signature.verify`.

---

## Morning watch-list (most-likely corrections, in priority order)

1. **Signature encoding** hex vs base64 (`signature.py`) — run checklist Section B4 first.
2. **Signature/event-type header names** exact casing (`const.py`).
3. **`published_after/before` param name + unit** (epoch seconds?) (`filters.py`/`const.py`).
4. **`/v1/version` path** presence (`api.get_version`).
5. **Entry `tags` + category nesting** shape (`normalize.py`).

Everything else is high-confidence; if it differs, the confined-module design means each fix is local and its test flips red→green to confirm.
