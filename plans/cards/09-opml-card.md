# C8 — OPML Card (`custom:miniflux-opml-card`)

**Status:** High-level plan
**Depends on:** F (foundation)
**Role in suite:** backup and restore. Small, deliberate, admin-flavored — the card version of "export before you experiment," which is exactly what a stress-testing user needs.

---

## Purpose

Drive the two OPML services from a dashboard: export the full subscription list as a downloadable file, and import an OPML document (pasted or from a local file) with an explicit preview/confirm step. Also the natural home for a "subscription snapshot" habit around risky operations (mass deletes, C3/C4 experiments).

## Integration surface used

| Kind | What | Why |
|---|---|---|
| Service | `export_opml` | Response string → client-side Blob download (`miniflux-YYYYMMDD.opml`) |
| Service | `import_opml {opml}` | The restore path (two-step, S5) |
| Service | `get_feeds` | Before/after feed counts around an import; preview diff hints |
| Entity | `sensor.*_feeds_with_errors` `total_feeds` attr | Cheap "63 feeds, 7 categories" summary line |

## Layout (sketch)

```text
┌──────────────────────────────────────────────┐
│ OPML backup & restore                        │
│ 63 feeds · 7 categories                      │
│                                              │
│ [⬇ Export subscriptions]                     │
│   last export this session: 12:41 ✓          │
│                                              │
│ [⬆ Import…]                                  │
│   └ paste OPML or pick a .opml file          │
│     preview: 12 outlines · 3 categories      │
│     [Cancel] [Import 12 feeds]               │
└──────────────────────────────────────────────┘
```

## Interactions

| Control | Action | Notes |
|---|---|---|
| ⬇ Export | `export_opml` → Blob → browser download | Also proves large string responses over the WS service path (S8) |
| ⬆ Import | File picker (`.opml`/`.xml`, read as text) **or** paste textarea | No upload endpoint needed — `import_opml` takes the document as a string |
| Preview | Client-side OPML parse: outline/category counts, first N titles | Purely informational; the server's parse is authoritative |
| Confirm | `import_opml {opml}` | Pending state (imports can be slow — Miniflux fetches feeds); then `get_feeds` re-query with a "+12 feeds" result line. Miniflux imports are additive/idempotent-ish (existing feeds skipped), stated in the confirm copy |
| Failure | Backend error verbatim; document retained in the form for correction | |

## Card configuration

```yaml
type: custom:miniflux-opml-card
show_import: true        # false → export-only card for cautious dashboards
filename_prefix: miniflux
```

## States & edge cases

- **Huge library export (S1):** hundreds of feeds → large response string; download must not truncate.
- **Malformed OPML:** client preview flags it, but the user may still submit — the server error is the contract, the preview is a courtesy.
- **Import during other card activity (S4):** success invalidates feed/category/entry caches suite-wide; C3's list grows without a reload.
- **Timeout risk (S8):** a big import may exceed the 30s API timeout upstream — this card is the most likely to surface that limit; finding out is part of the stress test (possible backend follow-up: async import acknowledgment).

## Stress-test value

Drives the last two never-UI-exercised services, the largest single request *and* response strings in the suite, and the one operation most likely to trip the API timeout. Its export button is also the suite's own safety net while every other destructive flow is being tested.

## Acceptance criteria

- Export downloads a valid OPML file that Miniflux itself re-imports cleanly.
- Import requires preview + explicit confirm (S5); success is verified by a feed-count delta, not just a 2xx.
- A deliberately truncated OPML document produces a visible server-side error with the document preserved for retry.
