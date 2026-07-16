# R1 — Contract-Pinning Checklist (run before freezing Phase 2)

**Why:** the design confines every exact Miniflux wire detail (auth header, field names, `total`/pagination, `/v1/version` presence, `/v1/feeds/counters` presence, webhook header names + payload shapes + signature scheme) to `api.py` + `normalize.py` + fixtures. This checklist captures those from **your** instance into `tests/fixtures/`, so the Phase-2 client is written against real bytes, not assumptions.

**Where to run:** any box that can reach Miniflux **and** has this repo checked out (commands write into `tests/fixtures/`). Run from the repo root. Everything below is copy-paste; you only edit the two `export` lines in Step 0.

**Time:** ~10 min. Read-only Section A is safe. Section B needs a throwaway feed (reversible). Section C is optional and self-contained.

---

## Step 0 — set two variables (the only editing you do)

```bash
export MF="https://reader.example.lan"     # your Miniflux base URL, NO trailing slash (include any sub-path)
export TOK="paste-your-api-key-here"        # Miniflux → Settings → API Keys → create one
export FX="tests/fixtures"; mkdir -p "$FX"
mf() { curl -sS -D "$FX/$1.headers" -o "$FX/$1.json" -H "X-Auth-Token: $TOK" "$MF$2"; echo "  saved $FX/$1.json"; }
```

> Using **Basic auth** instead of an API key? Redefine the helper once:
> `mf() { curl -sS -D "$FX/$1.headers" -o "$FX/$1.json" -u "user:pass" "$MF$2"; echo "  saved $FX/$1.json"; }`
> and note "auth = basic" in the report at the bottom.

### Smoke test (do this before anything else)

```bash
mf me /v1/me && python3 -m json.tool "$FX/me.json"
```

You should see your Miniflux user JSON. If you get an error, fix `$MF`/`$TOK` before continuing.
✅ This confirms the auth header name (`X-Auth-Token`) — assumption in `api.py` chunk 2.1.

---

## Section A — REST shapes (read-only, safe)

Paste this whole block; it captures every read endpoint the integration polls or queries:

```bash
mf version_v1   /v1/version
mf version_root /version
mf feeds        /v1/feeds
mf counters     /v1/feeds/counters
mf categories   /v1/categories
mf entries_unread  "/v1/entries?status=unread&limit=1"
mf entries_starred "/v1/entries?starred=true&limit=1"
mf entries_search  "/v1/entries?search=the&limit=1"
echo "done - files in $FX"
```

Then eyeball the important ones (small, phone-friendly):

```bash
python3 -m json.tool "$FX/feeds.json"    | head -60
python3 -m json.tool "$FX/counters.json" | head -30
python3 -m json.tool "$FX/entries_unread.json" | head -80
```

### Confirm while you look (these map to specific code assumptions)

**`version_v1` / `version_root`** — which one returned real content (HTTP 200 + a version), which 404'd?
→ tells `api.get_version` (2.2) which path to use / whether to fall back. Check status:
```bash
grep -H "^HTTP" "$FX/version_v1.headers" "$FX/version_root.headers"
```

**`feeds.json`** — confirm each feed object has: `parsing_error_count`, `parsing_error_message`, `checked_at`, `disabled`, and a nested `category` with `id` + `title`.
→ drives `normalize.feed_from_json` (1.3), `rollup` (1.7), the feeds-with-errors sensor (4.4). If a feed name differs, that's the pin.

**`counters.json`** — did it 200 with `unreads`/`reads` maps keyed by feed id? Or 404?
→ if absent, `rollup` (1.7) must derive unread from feeds/entries instead — flag it. This is the single most important "does it exist" check.

**`entries_unread.json`** — confirm the top level has a **`total`** count and an **`entries`** array, and each entry has: `id`, `status`, `starred`, `title`, `url`, `author`, `content`, `reading_time`, `published_at`, `changed_at`, `tags`, and nested `feed`/`category`.
→ drives `normalize.entry_from_json` (1.3), the `models.Entry` field list (1.1), pagination `total` (2.3).

**`entries_search.json` / `entries_starred.json`** — confirm `search=`, `starred=true` actually filtered (compare `total`).
→ confirms filter param names for `filters.to_query_params` (1.4).

---

## Section B — Webhook capture (headers + both payloads + signature scheme)

This is the part only a live instance can give you. You'll run a tiny catch server, point Miniflux at it, trigger both event types, then verify the signature.

### B1 — start the catch server (leave it running in this shell)

```bash
python3 - <<'PY'
import http.server, socketserver, time, os
d="tests/fixtures/webhook_capture"; os.makedirs(d, exist_ok=True)
class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        n=int(self.headers.get('Content-Length',0)); body=self.rfile.read(n)
        ts=time.strftime('%H%M%S'); base=f"{d}/{ts}"
        open(base+'.headers','w').write(self.requestline+'\n'+str(self.headers))
        open(base+'.body.json','wb').write(body)
        print('\n=== captured',ts,'===\n'+str(self.headers))
        print(body.decode('utf-8','replace')[:1500])
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
    def log_message(self,*a): pass
print('listening on :8099  — point Miniflux webhook here, Ctrl-C when done')
socketserver.TCPServer(("0.0.0.0",8099),H).serve_forever()
PY
```

The server saves each delivery's **exact headers** (reveals the signature + event-type header names) and **raw body bytes** (needed to verify the HMAC). It prints each hit so you can watch on your phone.

### B2 — point Miniflux at it (in the Miniflux web UI)

1. Settings → Integrations → **Webhook**.
2. Webhook URL: `http://<this-box-ip>:8099/`  (an IP/host Miniflux can reach — same LAN is fine).
3. **Save.** Miniflux shows a generated **Webhook secret** — copy it, you'll need it in B4 (and later for real HA setup).

### B3 — trigger both events

- **`new_entries`:** the reliable trick — **add a brand-new feed** (Feeds → Add feed → any active blog's RSS URL). Its first fetch makes every entry "new," which fires `new_entries` within a minute. (Keep this feed for Section C, or delete it after.)
- **`save_entry`:** open any entry in Miniflux and click **Save** (the save/share action). Fires `save_entry`.

Watch the catch-server shell — you should see two captures. Then `Ctrl-C` the server.

```bash
ls -la tests/fixtures/webhook_capture/
```

### B4 — verify the signature scheme

```bash
export WHSECRET="paste-the-webhook-secret-from-B2"
python3 - <<'PY'
import hmac, hashlib, glob, os
sec=os.environ["WHSECRET"].encode()
for b in sorted(glob.glob("tests/fixtures/webhook_capture/*.body.json")):
    raw=open(b,'rb').read()
    print(os.path.basename(b), "computed HMAC-SHA256 hex =", hmac.new(sec, raw, hashlib.sha256).hexdigest())
PY
grep -Ri "signature\|event-type\|event_type" tests/fixtures/webhook_capture/*.headers
```

**Compare** each `computed HMAC` against the signature value in the matching `.headers` file.
- Match → confirms **hex-encoded HMAC-SHA256 over the raw body** (the assumption in `signature.verify`, chunk 1.5). ✅
- No match → note the header value; we'll adjust the scheme (base64? different digest?) before writing 1.5.
- The `grep` line reveals the **exact header names** (expected around `X-Miniflux-Signature` and `X-Miniflux-Event-Type`) → pins `signature.extract_event_type` (1.5) + the handler (6.2).

### B5 — reset Miniflux

Put the Webhook URL back to blank (or to your real HA URL later per `docs/setup.md`). Done with capture.

---

## Section C — Mutations (optional, self-contained, reversible)

Only pins the mutation **request bodies**. Uses the throwaway feed from B3 so it never touches real data. Skip if short on time — official API body shapes are stable.

Grab one feed id and one entry id from that scratch feed:

```bash
mf feeds /v1/feeds
export FEED_ID=$(python3 -c "import json;d=json.load(open('$FX/feeds.json'));print(sorted(d,key=lambda f:f['id'])[-1]['id'])")
mf scratch_entries "/v1/feeds/$FEED_ID/entries?limit=1"
export ENTRY_ID=$(python3 -c "import json;print(json.load(open('$FX/scratch_entries.json'))['entries'][0]['id'])")
echo "FEED_ID=$FEED_ID  ENTRY_ID=$ENTRY_ID"
```

Round-trip each mutation (each prints its HTTP status; all reversible):

```bash
# bulk status: read then back to unread  -> pins PUT /v1/entries body (chunk 2.4 / service 5.2)
curl -sS -X PUT -H "X-Auth-Token: $TOK" -H "Content-Type: application/json" -w "  entries->read  HTTP %{http_code}\n"   -d "{\"entry_ids\":[$ENTRY_ID],\"status\":\"read\"}"   "$MF/v1/entries"
curl -sS -X PUT -H "X-Auth-Token: $TOK" -H "Content-Type: application/json" -w "  entries->unread HTTP %{http_code}\n" -d "{\"entry_ids\":[$ENTRY_ID],\"status\":\"unread\"}" "$MF/v1/entries"

# star toggle (twice = net no change)  -> confirms toggle semantics behind declarative star (D8, chunk 2.4)
curl -sS -X PUT -H "X-Auth-Token: $TOK" -w "  bookmark toggle1 HTTP %{http_code}\n" "$MF/v1/entries/$ENTRY_ID/bookmark"
curl -sS -X PUT -H "X-Auth-Token: $TOK" -w "  bookmark toggle2 HTTP %{http_code}\n" "$MF/v1/entries/$ENTRY_ID/bookmark"

# scope mark-all-read on the scratch feed  -> pins mark-all endpoint (service 5.2)
curl -sS -X PUT -H "X-Auth-Token: $TOK" -w "  feed mark-all-read HTTP %{http_code}\n" "$MF/v1/feeds/$FEED_ID/mark-all-as-read"

# single-feed refresh  -> pins refresh endpoint (service 5.3)
curl -sS -X PUT -H "X-Auth-Token: $TOK" -w "  feed refresh HTTP %{http_code}\n" "$MF/v1/feeds/$FEED_ID/refresh"
```

All `HTTP 2xx` → those endpoints/bodies are confirmed. Any `4xx` → copy the number into the report.

Clean up the throwaway feed when done:

```bash
curl -sS -X DELETE -H "X-Auth-Token: $TOK" -w "  delete scratch feed HTTP %{http_code}\n" "$MF/v1/feeds/$FEED_ID"
```

---

## Step Z — commit the fixtures & report back

Redact nothing structural, but **do not commit the webhook secret or your API key** (they're only in env vars, not files — good). The captured bodies contain your feed content; if that's sensitive, trim `content` fields before committing or keep fixtures in a private note. Then:

```bash
git add tests/fixtures && git commit -m "Add R1 contract-pinning fixtures from live Miniflux" && echo committed
```

**Paste me these answers** (this is what unblocks Phase 2 — copy the list, fill it in):

```
Miniflux version:                 __________   (from version_v1/version_root)
Auth: token (X-Auth-Token) or basic? __________
/v1/version present?              yes / no  (which path: /v1/version or /version)
/v1/feeds/counters present?       yes / no
Entries response has top-level `total`?  yes / no
Signature header name:            __________   (from B4 grep)
Event-type header name:           __________
Signature scheme confirmed HMAC-SHA256 hex over raw body?  yes / no  (from B4 compare)
Any field-name surprises in feeds/entries vs the lists above? __________
Any mutation returning non-2xx?   __________
```

With those, the implementer freezes `const.py` header/param constants, `normalize.py` field maps, and the Phase-1/Phase-2 fixtures — and the "written against assumptions" risk (R1) is closed.
