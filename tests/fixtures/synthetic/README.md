# Synthetic fixtures (pre-R1)

Hand-built JSON matching `plans/decisions-and-assumed-contract.md`'s assumed
Miniflux wire shapes — **not** real recordings. Used by Phase 1 pure-core
tests (`normalize.py`, `webhook_payload.py`) so the build doesn't block on
`plans/r1-contract-pinning.md`.

When the checklist runs, it writes **real** recordings directly under
`tests/fixtures/` (one level up — `feeds.json`, `entries_unread.json`,
`webhook_capture/*.body.json`, etc.), never into this `synthetic/`
subdirectory. That separation is deliberate: it means real recordings can
land without colliding with or silently overwriting these placeholders.

**Morning reconciliation:** diff a real recording against the matching file
here. If shapes agree, the assumption held — no code change needed. If they
differ, fix `normalize.py`/`const.py` per the assumption's confidence marker
in `decisions-and-assumed-contract.md`, update the affected test(s) in
`tests/test_normalize.py`/`tests/test_webhook_payload.py`, and only then
retire the synthetic file that was wrong (keep the rest — most of this
contract is high-confidence and likely won't move).
