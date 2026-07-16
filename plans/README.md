# Implementation Plans

TDD build plan for the Miniflux Home Assistant integration, derived from [`../docs/architecture.md`](../docs/architecture.md) and [`../docs/setup.md`](../docs/setup.md).

**Start with [`00-overview.md`](./00-overview.md)** — it defines the TDD contract (red→green→refactor per chunk), tooling, coverage floors, seam discipline, and the build sequence. Then work the phases **in order**.

| Phase | Doc | Builds |
|---|---|---|
| 0 | [`01-scaffolding-and-hacs.md`](./01-scaffolding-and-hacs.md) | Package skeleton, `manifest.json`, `hacs.json`, CI gates (hassfest + HACS + pytest), `const.py` |
| 1 | [`02-pure-core.md`](./02-pure-core.md) | 9 framework-free modules (models, timeutil, normalize, filters, signature, webhook_payload, rollup, transitions, errors) — 100% coverage |
| 2 | [`03-api-client.md`](./03-api-client.md) | `api.py` — the only HTTP; auth, sub-path URLs, retry/concurrency, pagination (D7), declarative star (D8) |
| 3 | [`04-config-and-coordinator.md`](./04-config-and-coordinator.md) | Config/options/reauth flows, coordinator, `__init__` wiring; two-phase webhook handshake (D9) |
| 4 | [`05-entities.md`](./05-entities.md) | Unread / starred / feeds-with-errors sensors + reachability binary sensor (pure projections, D3) |
| 5 | [`06-services.md`](./06-services.md) | Query / mutation / admin service families + `services.yaml` (the §4 split) |
| 6 | [`07-webhook-receiver.md`](./07-webhook-receiver.md) | Signed webhook receiver (verify→project→emit→nudge, D1) + repair issues |
| 8 | [`08-diagnostics-i18n-release.md`](./08-diagnostics-i18n-release.md) | Diagnostics (redacted), translations, README, HACS release |

Each chunk (e.g. `P1.4`) is an individually testable red→green→refactor unit with its tests listed first. Build sequentially; deviate only on a real blocker (overview §7).
