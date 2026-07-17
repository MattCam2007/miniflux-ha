# 22 — Hardening: questions to answer before the plan is final

Companion to [`21-hardening-implementation.md`](./21-hardening-implementation.md). Three groups:

- **A — diagnostics**: things only the real instance can answer. Run once, paste results.
- **B — decisions**: choices that shape the implementation. **Every one has a proposed default** — replying "defaults fine" answers the whole group.
- **C — context**: sharpens priorities, nothing blocks on it.

Units in doc 21 reference these as `[Q-A1]`, `[Q-B4]`, etc.

---

## A — Diagnostics from the real instance

**A1. What's in Settings → Dashboards → ⋮ (top-right) → Resources?**
List every entry that mentions miniflux: the exact URL including any `?v=`, and how many entries there are.
*Why:* this single screen distinguishes all four staleness stories (stale `?v=`, duplicate entries, a `/local/…` copy, auto-registration never ran). The playbook table in doc 21 maps each outcome to its remediation.

**A2. Console probe — is the browser executing the old bundle?**
On a dashboard, F12 → Console:
```js
const probe = async (cache) => (await (await fetch('/miniflux/frontend/miniflux-cards.js', {cache})).text()).includes('__miniflux_default__') ? 'NEW (has fix)' : 'OLD (pre-fix)';
console.log('server:', await probe('reload'), '| browser cache:', await probe('force-cache'));
```
*Why:* `server: NEW | cache: OLD` confirms the caching diagnosis. `server: OLD` would mean the 0.1.1.2 files never landed on disk — a different (install-side) problem.

**A3. Startup log lines.**
Settings → System → Logs → search "miniflux". Anything mentioning Lovelace/resources ("Lovelace not set up yet", "YAML mode", import errors)?
*Why:* pinpoints which silent skip-branch (if any) `frontend.py` hit on your install — decides whether H1-U3's started-event retry is the fix or just insurance.

**A4. Your exact HA version** (Settings → About).
*Why:* the lovelace/registry internals were verified against core `dev`; worth pinning against the version you actually run, and it sets the integration's tested-floor.

**A5. What exactly did "manually install resources" involve?**
(a) Added a resource entry in the UI pointing at `/miniflux/frontend/miniflux-cards.js[?v=…]`, or (b) copied the JS file somewhere (e.g. `/config/www` → `/local/…`), or (c) something else?
*Why:* (b) creates a permanently-stale copy that no fix of ours can ever update — H1-U3's conflict detection exists for exactly this, and your answer decides how aggressive it needs to be.

**A6. Where do you use these dashboards** — desktop browser, the companion app, or both?
*Why:* cache-reset instructions differ (hard-refresh vs. companion app's "Reset frontend cache"), and it sets H3-U4's mobile-layout priority.

**A7. Roughly how many feeds do you have?** (Not entries — feeds.)
*Why:* the grouping-lost-past-100-feeds bug (H2-U5) is either urgent or theoretical depending on this number.

**A8. Are any of your dashboards YAML-mode?** (If you don't know, they're almost certainly storage-mode; A1's screen existing at all implies storage-mode.)
*Why:* auto-registration is impossible in YAML mode by design — that path is docs-only, and Repair noise for it would be wrong.

---

## B — Decisions (defaults proposed)

**B1. Bundle caching: switch to revalidate-every-load?**
Serving with `cache_headers=False` means each dashboard load makes one conditional request (~instant 304 for the 57 KB file) instead of trusting a 31-day cache. **Default: yes.** The alternative (keep long cache, rely purely on `?v=` reconciliation) leaves every manual/YAML resource user exposed to exactly what just happened to you. *(Gates H1-U1.)*

**B2. Version source of truth: `manifest.json`?**
Bake the integration version into the JS at build time so the bundle self-identifies (console banner + editor footer), accepting the coupling that every version bump requires a bundle rebuild (CI already enforces bundle freshness). `frontend/package.json`'s stale `0.1.0` stops mattering. **Default: yes.** *(Gates H1-U2.)*

**B3. Repair-issue appetite for resource problems?**
Proposed: WARNING-severity, self-clearing Repairs for (a) registration genuinely failing and (b) a conflicting foreign bundle copy — but *not* for YAML mode (supported configuration, log-only). **Default: as proposed.** Alternative: log-only everywhere (quieter, but reproduces the silent-failure problem this plan exists to kill). *(Gates H1-U3.)*

**B4. Editor technology: HA's internal `ha-form`, or our own controls styled to match?**
`ha-form`/selectors give the pixel-native look but are **not a public API for custom cards** — internals shift between HA releases and breakage lands on us. Own controls styled with theme variables are slightly less native but can't be broken by an HA upgrade. **Default: own styled controls now; revisit `ha-form` once the suite is stable.** *(Gates H3-U3.)*

**B5. Icons: `<ha-icon>` or inline SVGs?**
`<ha-icon>` (mdi) is what effectively every custom card uses — a runtime dependency on HA's frontend that is stable in practice. Inline SVGs are zero-coupling but grow the bundle and bypass HA's icon theming. **Default: `<ha-icon>`.** *(Gates H3-U2.)*

**B6. Offline: actually disable actions while Miniflux is unreachable?**
The banner already *claims* "actions are disabled." **Default: make it true** (disable mutating controls, keep last-known list visible). Alternative: soften the banner text instead — cheaper, but lets users queue actions that are guaranteed to fail. *(Gates H2-U2.)*

**B7. Release cadence and branch hygiene?**
**Default: merge PR #8 into `main` first, then tag each completed phase from `main`** (e.g. `0.1.2` = H1, `0.1.3` = H2, `0.2.0` = H3) so every phase gets a real-dashboard shakedown. Current tags (`0.1.1.1`, `0.1.1.2`) point into a feature branch, and `0.1.1.1` points at a commit *without* its own manifest bump — worth not repeating. Alternative: one big release after H3 (fewer HACS round-trips — relevant while your HACS "update information" is flaky). *(Gates H4-U4.)*

**B8. Non-admin dashboard users?**
Cards currently gate destructive UI only via config flags (`show_delete`, `show_add`). If non-admin household members see these dashboards, we could additionally hide mutating controls for non-admins (`hass.user.is_admin`). **Default: no — flags suffice** until a real need shows up. *(Would add a unit to H2 if yes.)*

---

## C — Context (nothing blocks on these)

**C1. What does "not suck" look like to you?**
Name a first-party card (or a HACS card you like) whose look/density the suite should imitate — e.g. the native To-do list card's row style vs. something denser. Sets H3-U1's target so restyling doesn't chase a moving taste.

**C2. What else is in your resource list / HACS frontend section?**
Other custom cards you run (Mushroom, button-card, …). Helps interpret A1's output and gives a styling reference point that already looks right on *your* theme.

**C3. Is the webhook wired up on this install?**
Determines whether the cards' refresh bus gets admin-event ticks (near-instant list refreshes after external changes) or falls back to poll-interval ticks — affects how "live" the cards will feel during your validation, independent of any bug.
