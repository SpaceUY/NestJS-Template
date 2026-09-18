# NestJS Template — Modularity & Documentation Audit, 2026-09-18

Audited against commit `ea4d7e1` on `master`, with `pnpm install --frozen-lockfile`
completed.

| Gate | Result |
|---|---|
| `pnpm run build` | PASSES — exit 0 |
| `pnpm exec eslint` | 0 errors, 4 warnings |
| `pnpm test` | 36 suites, 295 tests, all passed |
| `pnpm run docs:check` | passed |

## What this audit asks

The template's stated purpose (`CLAUDE.md`, opening paragraph) is that every
top-level directory under `src/` can be lifted into another repository on its
own, and that a clone can be stripped down to the modules a project needs.
This audit tests that claim three ways: statically (the import graph), by
experiment (compiling an extracted module in isolation), and by reading every
guide the template ships to see whether it still describes the code.

Finding IDs are stable. `M` = modularity, `EXT` = extraction, `DOC` =
documentation. Findings from `docs/audit/2026-09-11-template-audit.md` keep
their original IDs and are reconciled in the last section. When a finding is
fixed, strike it here rather than deleting it, so citations stay resolvable.

### Module independence

Evidence: `node scripts/check-module-independence.mjs --report` at `4d64b6d`,
dumped to `.superpowers/audit-evidence/module-graph.txt`. It found 14
violations, now recorded verbatim in
`docs/audit/module-independence-baseline.json` as the ratchet baseline (see
`pnpm run modularity:check`, which passes clean against it and fails the
moment a new violation appears — proven in this audit's working notes by a
throwaway edit to `src/cache/abstract/cache.service.ts`, reverted immediately
after).

| ID | Finding |
|----|---------|
| **M1** | Six absolute `src/...` import specifiers, four files: `src/auth/jwt.strategy.ts:6-7`, `src/auth/google/google.controller.ts:3`, `src/auth/google/google.service.ts:5-6`, `src/spaceship/spaceship.module.ts:2`. `tsconfig.json` sets no `paths`, so these resolve only through `baseUrl: "./"` and break the instant the owning module is copied into another repo. Unchanged from N6. |
| **M2** | `queues` reaches into the app root's config scope: `src/queues/queues.module.ts:7` (`import ... from '../redis.scope'`) and `src/queues/abstract/tests/queues.module.di.spec.ts:26` (`import ... from '../../../redis.scope'`) both resolve to `src/redis.scope.ts`, module `(app)`. So `queues` cannot be copied into another repo without also carrying the host application's own root config file. |
| **M3** | `queues` (tier `infrastructure`) imports the demo feature module `spaceship`'s notification code at `src/queues/queues.module.ts:8-15` (`SPACESHIP_NOTIFICATION_QUEUE`, `SpaceshipNotificationProcessor`, `NotificationRecipientsAbstractModule`, `ConfigNotificationRecipientsProvider`, `notificationRecipientsScope`) and again at `src/queues/abstract/tests/queues.module.di.spec.ts:18,28`. So `queues` cannot be extracted without `spaceship`, even though `queues` is meant to be a generic infrastructure module and `spaceship` is the disposable reference feature. |
| **M4** | `database` (tier `infrastructure`) imports the feature module `auth`'s `AuthType` enum at `src/database/entities/user.entity.ts:2` (consumed at :17-18). So `database` cannot be extracted on its own without `auth`, contrary to `database`'s stated role as a generic entity/migration layer. See M8 for why `database`'s own tier assignment is part of what makes this read as a violation. |
| **M5** | **Strongest finding in this audit.** Tarjan SCC detection over the import graph surfaces a 3-node cycle, `cycle\|(app),queues,spaceship`, invisible to the old 2-node-only cycle rule this checker replaced. It closes because `(app)` imports `spaceship` directly (`src/app.module.ts:32`), `spaceship` imports `queues` (`src/spaceship/notification/notification.module.ts:3`, among others), and `queues` imports back into `(app)` via `redis.scope` (M2). Concretely: the app root, the general-purpose `queues` infrastructure module, and the throwaway `spaceship` demo feature are one mutually-dependent knot — none of the three can be removed or lifted into another repo without pulling the other two along with it. |
| **M6** | `cycle\|auth,database`: `auth` imports `database`'s `User` entity in 7 places (e.g. `src/auth/jwt.strategy.ts`, `src/auth/core/auth-token/auth-token.service.ts`, `src/auth/google/google.service.ts`) and `database` imports `auth`'s `AuthType` enum back (`src/database/entities/user.entity.ts:2`, M4). So `auth` and `database` can only ever be extracted together, never separately. |
| **M7** | `cycle\|common,config-provider`: `common` imports `config-provider` twice (`src/common/observability/analytics/config/analytics.scope.ts:2-3`) and `config-provider` imports `common`'s logger back 5 times (`src/config-provider/abstract/config-provider-abstract.module.ts:20`, `src/config-provider/abstract/config-provider.service.ts:1-2`, plus their `.unit.spec.ts` counterparts). So the two platform-tier modules can only be extracted as a pair. |
| **M8** | The `TIERS` map's two arguable calls (flagged in the task brief): `database` is tiered `infrastructure` although it ships the domain `User` entity, and `templates` is tiered `feature` although it is pug assets consumed only by the infrastructure module `email`. This audit leaves both as-is — retiering is a fix, not a finding — but records the consequence: `database`'s `infrastructure` tier is why M4 reads as a tier violation at all (reclassifying it `feature` would drop that one violation line from the tier table, though the `auth`/`database` cycle in M6 would remain regardless of tier). No `templates` edge appears among the current 14 violations, so `templates`'s classification is not currently masking anything, but a reader relying on the tier table to judge `templates` in isolation should know the call is disputed. |
| **M9** | **Checker coverage boundary — observability blind spot.** `moduleOf()` keys on the first path segment, so `src/common/observability/{logger,analytics,telemetry}` all collapse into one `common` module, even though the root `CLAUDE.md` module map lists the three as separate modules with their own `CLAUDE.md`/`README.md`. Resolved by hand rather than by extending the checker (a `moduleOf()` change and re-baseline would touch `scripts/`, outside this task's file list — recorded here as the call this task made and why). By-hand result: `analytics` imports `logger` in two places, `src/common/observability/analytics/posthog-adapter/posthog-adapter.service.ts:6-7` and `src/common/observability/analytics/console-adapter/console-adapter.service.ts:4-5` (both pull `LoggerService` and `NestLoggerAdapter`); `telemetry` (`src/common/observability/telemetry/tracing.bootstrap.ts`, `otel-env.ts`) imports neither `logger` nor `analytics`. So `analytics` cannot be extracted independently of `logger` despite the module map presenting them as siblings, while `telemetry` genuinely can be. The checker's violation count does not and cannot reflect this — it is a coverage gap, not a ratcheted defect. |

### Extraction

### Contract conformance

### Agent guides (CLAUDE.md)

### Human guides (README.md)

### Prior-audit reconciliation
