# Phase 0 — Scaffolding & HACS Packaging

**Goal:** a valid, empty-but-installable HACS integration whose CI gates (hassfest, HACS action, pytest) are green, plus the single-source-of-truth `const.py`. No behavior yet — this phase exists so every later chunk has a package to live in and gates that fail loudly on packaging regressions.

**Depends on:** nothing.
**Produces:** package skeleton, `manifest.json`, `hacs.json`, CI workflows, test harness, `const.py`.
**Architecture refs:** D6 (no runtime deps), R5 (caps in one place), R7 (HA version floor), §8 (test rings).

**TDD note for this phase:** packaging is partly declarative, so "red" here means *the gate fails* (hassfest errors / HACS action errors / pytest can't collect). Two chunks (0.4, 0.5) are genuine red-green unit tests. Order matters: 0.1→0.2→0.3 make the gates go green; 0.4→0.5 add the first real tests.

---

## Chunk 0.1 — Package skeleton + manifest

**Purpose:** minimum files for HA to recognize a custom integration and for HACS to recognize the repo.

**Produces:**
- `custom_components/miniflux/__init__.py` — empty `async_setup`/no-op for now (returns `True`), enough to import.
- `custom_components/miniflux/manifest.json` with keys:
  - `domain: "miniflux"`, `name: "Miniflux"`
  - `version: "0.1.0"` (**required by HACS** for custom integrations)
  - `config_flow: true`
  - `iot_class: "local_polling"` — polling is authoritative (D4); webhook is an accelerator. Flag as a minor open choice vs `local_push`; `local_polling` is the honest default because the integration is fully functional with no webhook.
  - `integration_type: "hub"` — one config entry represents one Miniflux instance (rendered as a device, Phase 4).
  - `documentation`, `issue_tracker` → this repo's URLs.
  - `codeowners: ["@MattCam2007"]`
  - `requirements: []` — the D6 payoff; no PyPI dependency.
  - `dependencies: ["webhook"]` — the receiver (Phase 6) needs HA's `webhook` component; declaring it here guarantees load order.
- `hacs.json` at repo root:
  - `name: "Miniflux"`, `render_readme: true`, `homeassistant: "<floor>"` (R7; pick the floor once the flows/services APIs are confirmed — anything ≥ 2024.6 covers service-response + options-flow + repairs; default to a recent stable and let 0.2's gate confirm).

**Tests / gate (red→green):**
- Red: `hacs/action` fails (no `hacs.json`) and hassfest fails (no manifest).
- Green: both gates pass on the skeleton. (Gates wired in 0.2; until then verify locally by asserting the JSON files parse and carry required keys — see 0.4.)

**DoD:** files exist, JSON valid, integration importable in a Python shell with HA installed.

---

## Chunk 0.2 — CI workflows (the gates)

**Purpose:** make hassfest, HACS validation, and the test suite run on every push/PR so later chunks can't silently break packaging.

**Produces:** `.github/workflows/`:
- `validate.yml` — two jobs:
  - **hassfest** via `home-assistant/actions` hassfest action.
  - **HACS** via `hacs/action` with `category: integration`. Expect a *brand* warning (logo not yet in home-assistant/brands) — allowed to warn, not fail; document in Phase 8 (8.4).
- `test.yml` — `pytest` across a small HA/Python matrix (at least the declared floor and latest), running `ruff` + `pytest --cov` with per-module floors (§5 of overview) enforced.

**Tests / gate:** the workflows themselves are the deliverable; success = green checks on the branch/PR. Locally, `pytest` exits 0 with zero/So-far-trivial tests collected.

**DoD:** all three gates green on PR #1's branch.

---

## Chunk 0.3 — Test harness & tooling config

**Purpose:** shared fixtures and tool config so every later phase injects rather than rebuilds.

**Produces:**
- `requirements_test.txt` pinning: `pytest-homeassistant-custom-component` (pins compatible HA), `pytest-cov`, `aioresponses` (or rely on the plugin's `aioclient_mock`), `ruff`.
- `tests/__init__.py`, `tests/conftest.py`:
  - autouse `enable_custom_integrations` fixture.
  - `mock_config_entry` factory (domain, unique_id, data = url/api_key/webhook_id, options = secret/scan_interval/local_only).
  - `fake_api` builder — an object matching `api.py`'s eventual public surface (async methods returning canned models); Phase 2 will make the real client, but the *interface* is stubbed here so Phases 3–6 can inject it.
  - `snapshot_factory` — builds `Snapshot` (from Phase 1 models) with tunable unread/starred/error-feeds.
  - `signed_webhook_request` helper — given secret + body dict, produces raw bytes + valid signature header (used in Phase 6; the signing logic mirrors `signature.py` and is asserted against it in Phase 1 so the helper can't drift).
- `pyproject.toml` (or `setup.cfg`): `ruff` config, `pytest` config (asyncio mode, coverage sources/floors), `tool.coverage` per-module floors.
- `tests/fixtures/` directory + a `README.md` stub describing the R1 tagging convention (each fixture notes the Miniflux version it was recorded from).

**Tests / gate:** `pytest` collects and the fixtures import cleanly. `fake_api` and `snapshot_factory` get a smoke test once Phase 1 models exist (write that smoke test at the start of Phase 1, not here — here they may reference not-yet-existing models as `# TODO wire in P1`; keep the harness minimal until models land). To avoid a forward dependency, ship `conftest` builders that depend on models **at the start of Phase 1** (chunk 1.1) rather than now; in Phase 0 ship only `enable_custom_integrations`, `mock_config_entry` (plain dict data), and tool config.

**DoD:** `pytest -q` runs green with the harness; `ruff` clean.

> Sequencing correction captured inline: model-dependent builders (`fake_api`, `snapshot_factory`, `signed_webhook_request`) move to chunk 1.1's deliverables because they reference Phase-1 types. Phase 0 ships only model-free harness pieces. This keeps every chunk buildable with only prior chunks (overview §2).

---

## Chunk 0.4 — Manifest & HACS descriptor tests

**Purpose:** turn "the JSON is valid" into an actual failing-first test, and lock the required keys so a careless edit is caught by unit test, not only by the CI action.

**Public surface under test:** the static files from 0.1.

**Tests to write first (red):**
- given `manifest.json` → then it parses and contains `domain == "miniflux"`, `version` present and semver-shaped, `config_flow is true`, `requirements == []`, `dependencies` includes `"webhook"`, `documentation`/`issue_tracker` are URLs.
- given `hacs.json` → then it parses and contains `name`, `render_readme is true`, a `homeassistant` floor string.
- given manifest `iot_class` → then it is one of HA's allowed values.

**DoD:** tests fail before 0.1's files exist (or with a key removed), pass with them present.

---

## Chunk 0.5 — `const.py` (single source of truth)

**Purpose:** every domain string, event name, and cap/default in exactly one place (seam rule 5; R5).

**Public surface:**
- `DOMAIN = "miniflux"`.
- Config/option keys: `CONF_URL`, `CONF_API_KEY`, `CONF_VERIFY_SSL`, `CONF_WEBHOOK_ID`, `CONF_WEBHOOK_SECRET`, `CONF_SCAN_INTERVAL`, `CONF_LOCAL_ONLY`.
- Event types: `EVENT_NEW_ENTRIES = "miniflux_new_entries"`, `EVENT_ENTRY_SAVED = "miniflux_entry_saved"`, `EVENT_FEED_ERROR = "miniflux_feed_error"`, `EVENT_FEED_RECOVERED = "miniflux_feed_recovered"`.
- Caps/defaults (R5 — all tunable here): `DEFAULT_SCAN_INTERVAL = 300`, `MIN_SCAN_INTERVAL = 60`, `EVENT_ENTRIES_CAP = 50`, `ERROR_FEEDS_ATTR_CAP = 25`, `BY_CATEGORY_ATTR_CAP = 100`, `SEARCH_LIMIT_DEFAULT = 100`, `SEARCH_LIMIT_MAX = 500`, `HYDRATE_IDS_MAX = 100`, `UPDATE_IDS_MAX = 500`, `WEBHOOK_MAX_BODY_BYTES = 10_485_760`, `REFRESH_DEBOUNCE_SECONDS = 10`, `TITLE_TRUNCATE = 256`, `API_CONCURRENCY = 4`, `API_TIMEOUT_SECONDS = 30`.
- Service names and platform list constants.

**Tests to write first (red):**
- `DOMAIN == "miniflux"`; every event constant matches the `miniflux_*` names in architecture §3.5 (guards against renames that would break automations).
- caps are the expected ints and `MIN_SCAN_INTERVAL <= DEFAULT_SCAN_INTERVAL`; `SEARCH_LIMIT_DEFAULT <= SEARCH_LIMIT_MAX`.

**DoD:** constants imported by later phases; no literal cap appears anywhere but here (enforced by review + a grep-style test optional).

---

## Phase 0 exit criteria

- CI: hassfest ✅, HACS action ✅ (brand warning acceptable), pytest ✅ with 0.4/0.5 tests green.
- Integration installs as a HACS *custom repository* and appears in Add Integration (it will error on configure until Phase 3 — acceptable; not yet released).
- `const.py` is the only home for domain strings and caps.
