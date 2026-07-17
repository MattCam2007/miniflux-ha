# C8 — OPML Card — Units & Usage

> **🟡 PHASE 2 — DEFERRED.** Not part of minimum-bar Phase 1 (decision **D‑1**, [`00-START-HERE.md`](./00-START-HERE.md)). Do not build during Phase 1.

**High-level source:** [`../09-opml-card.md`](../09-opml-card.md). Backup and restore — export before you experiment. Drives the last two never-UI-exercised services and the largest request/response strings in the suite.
**Depends on:** F (all), `<mf-confirm>` (F-U9).

---

## Units

### `C8-U1` — Export → client-side download
**Depends on:** F-U4
**Behavior:** `export_opml` → response string → `Blob` download `miniflux-YYYYMMDD.opml` (`filename_prefix`); "last export this session" note; proves large string responses over the WS service path (`S8`); summary line "N feeds · M categories" from the `total_feeds` attribute.
**Tests:** export triggers a Blob download with the right filename; large response not truncated; session timestamp recorded; summary line from attribute.

### `C8-U2` — Import (paste/file) → preview → confirm
**Depends on:** F-U9
**Behavior:** `.opml`/`.xml` file picker (read as text) **or** paste textarea; client-side preview (outline/category counts, first N titles — informational only); `<mf-confirm>` "Import N feeds" → `import_opml {opml}` with a pending state (imports can be slow); on success re-query `get_feeds` and show a "+N feeds" delta; malformed OPML flagged by preview but still submittable (server parse is authoritative); failure keeps the document for correction; `show_import:false` → export-only card.
**Tests:** file read to text; paste path; preview counts; confirm required (`S5`); success shows feed delta not just 2xx; malformed → preview flags, submit → backend error retained; `show_import:false` hides import.

### `C8-U3` — Timeout & suite-wide invalidation
**Depends on:** C8-U2, F-U7
**Behavior:** a big import may exceed the 30s upstream API timeout — the most likely card to surface it; the pending state and error handling must survive that (surfacing it is part of the stress test; possible backend follow-up: async import ack — noted in concerns); success invalidates feed/category/entry caches suite-wide so C3/C4 grow without reload (`S4`).
**Tests:** timeout → normalized error, form retained; success emits combined bus invalidation.

---

## Usage — `custom:miniflux-opml-card`

Back up and restore your subscriptions. Also the suite's safety net while you experiment with the destructive management cards.

```yaml
type: custom:miniflux-opml-card
show_import: true          # false → export-only card for cautious dashboards
filename_prefix: miniflux
```

| Option | Type | Default | Notes |
|---|---|---|---|
| `show_import` | bool | `true` | Hide the import flow when false |
| `filename_prefix` | string | `miniflux` | Export filename prefix (`<prefix>-YYYYMMDD.opml`) |

**Export:** tap **⬇ Export** to download an OPML file of all subscriptions. **Import:** paste OPML or pick a `.opml` file, review the preview (feed/category counts), then confirm. Import is additive — Miniflux skips feeds you already have. Success is verified by a feed-count delta, not just a success response.

**Notes:** a large import can be slow (Miniflux fetches each feed) and may hit the 30-second API timeout; if so the card shows an error and keeps your document so you can retry. Keep an export handy before using the delete flows in the feed/category cards.

**Acceptance:** export downloads a valid OPML that Miniflux re-imports cleanly; import requires preview + explicit confirm and reports a feed-count delta; a truncated document produces a visible server error with the document preserved.
