# SpaceDev NestJS Template

A reusable NestJS backend template. Every top-level directory under `src/` is a
module built to be lifted into another repository on its own. That portability
is a hard requirement, not an aspiration — it is the reason this template
exists, and it is what the invariants below protect.

## How this file relates to the module files

This file is always in context. A `CLAUDE.md` inside a module directory loads
lazily — only when you read or edit a file in that subtree. So: what is true
everywhere lives here; what is true of one module lives in that module's file.
Module files are never `@`-imported here, because that would inline all of them
into every session and defeat the lazy loading.

Before changing anything under `src/<module>/`, read `src/<module>/CLAUDE.md`.

## Module map

| Directory | Agent guide | Human guide |
|---|---|---|
| `src/config-provider` | `src/config-provider/CLAUDE.md` | `src/config-provider/README.md` |
| `src/common` | `src/common/CLAUDE.md` | `src/common/README.md` |
| `src/common/observability/logger` | `src/common/observability/logger/CLAUDE.md` | `src/common/observability/logger/README.md` |
| `src/common/observability/telemetry` | `src/common/observability/telemetry/CLAUDE.md` | `src/common/observability/telemetry/README.md` |
| `src/database` | `src/database/CLAUDE.md` | `src/database/README.md` |
| `src/analytics` | `src/analytics/CLAUDE.md` | `src/analytics/README.md` |
| `src/auth` | `src/auth/CLAUDE.md` | `src/auth/README.md` |
| `src/cache` | `src/cache/CLAUDE.md` | `src/cache/README.md` |
| `src/cloud-storage` | `src/cloud-storage/CLAUDE.md` | `src/cloud-storage/README.md` |
| `src/email` | `src/email/CLAUDE.md` | `src/email/README.md` |
| `src/health` | `src/health/CLAUDE.md` | `src/health/README.md` |
| `src/push-notification` | `src/push-notification/CLAUDE.md` | `src/push-notification/README.md` |
| `src/templating` | `src/templating/CLAUDE.md` | `src/templating/README.md` |
| `src/templates` | `src/templates/CLAUDE.md` | `src/templates/README.md` |
| `src/queues` | `src/queues/CLAUDE.md` | `src/queues/README.md` |

Shared references: `docs/architecture/module-contract.md` (the adapter-module
contract), `docs/audit/2026-09-11-template-audit.md` (known defects, the
`B`/`N`/`D`/`C`/`TS`/`L`/`R`/`G` series) and `docs/audit/2026-09-18-modularity-audit.md`
(the `M`/`EXT`/`DOC` series, and its reconciliation of the older audit),
`src/common/observability/logger/PRACTICES.md` (logging rules).

## Commands

```bash
pnpm install                  # pnpm 10.15.1, Node 24.15.0 — never npm or yarn
pnpm run start:dev            # watch mode
pnpm run build                # nest build
pnpm test                     # jest, rootDir src, testRegex .*\.spec\.ts$
                              # always through the script — see ## Toolchain
pnpm run test:cov             # jest + coverageThreshold — what CI runs
pnpm run test:e2e             # jest --config ./test/jest-e2e.json
pnpm run lint                 # eslint --fix
pnpm run lint:ci              # eslint, no --fix — what CI runs
pnpm run docs:check           # validates every CLAUDE.md
pnpm run modularity:check     # module import graph vs. the recorded baseline
pnpm run db:migration:generate -- src/database/migrations/<Name>
pnpm run db:migration:run
pnpm run db:migration:revert
```

A local Postgres is available through `docker-compose.yml`.

## Toolchain

Four facts about the build that are not obvious from any single file, and that
you will otherwise rediscover as an error message.

**Nest 12 is ESM-only; this template is not.** Every `@nestjs/*` 12.x package
is `"type": "module"` with no CommonJS build. This repo has no `"type"` field
and emits CommonJS, and reaches Nest through Node's `require(esm)` — supported
from Node 22.12, and the engine here is Node 24. `tsconfig.json` therefore sets
`"module": "nodenext"` with `"moduleResolution": "nodenext"`, which is exactly
what `nest new --type cjs` generates for 12.x. Do not "fix" it back to
`"commonjs"`: node10 resolution cannot read Nest 12's `exports` map, and
`nodenext` in a non-`type: module` package still keeps `T5`'s extensionless
relative imports legal.

**Never run `jest` directly — run `pnpm test`.** A CommonJS test cannot
`require()` an ESM dependency under Jest unless Jest itself is started as
`node --experimental-vm-modules ./node_modules/jest/bin/jest.js`, which is what
every `test*` script does. Bare `jest` fails with `SyntaxError: Unexpected
token 'export'` on `@nestjs/terminus` and anything else ESM. The scripts also
pass `--disable-warning=ExperimentalWarning`, purely so the VM-modules notice
does not print once per worker; drop that flag if you are debugging Node
warnings.

**TypeScript 6 changed two defaults this repo depends on.** It no longer
auto-includes `@types/*` packages, so they are named in
`"types": ["node", "jest"]` — add to that list when you add a global type
package, or it silently will not load. And it no longer infers `rootDir`
(TS5011), so the base config pins `"."` and `tsconfig.build.json` narrows it to
`"./src"` to keep the emitted layout at `dist/main.js`.

**One `paths` entry exists and is a workaround.** `@nestjs/throttler@6.7.0`'s
declarations deep-import `@nestjs/common/interfaces`, which Nest 12's `exports`
map resolves to a file that does not exist. `tsconfig.json` maps it back. It is
the only such specifier in the tree — delete the entry, do not extend it, the
day throttler ships a Nest 12 build.

## Invariants

These hold in every module. Module files cite them by ID rather than restating
them.

**T1 — Consumers depend on abstractions, never on adapters.** Inject the
abstract class (`EmailService`, `CacheService`, `LoggerService`,
`CloudStorageService`, `TemplateService`, `PushNotificationService`,
`ConfigProviderService`). A concrete adapter class is named in exactly one
place: the `forRoot`/`forRootAsync`/`register` call in `src/app.module.ts`.
Importing `S3AdapterService` or `ResendAdapterService` from a feature module is
always wrong.

**T2 — All configuration flows through a config scope.** Never read
`process.env` outside `src/config-provider/env-adapter/env-config.adapter.ts`,
`src/database/data-source.ts` (the TypeORM CLI entry point, which runs outside
the Nest container) and
`src/common/observability/telemetry/otel-env.ts` (runs before
`NestFactory.create()`, so before the Nest DI container exists — see that
file's guide). Define a scope with `defineConfigScope`, validate it with Joi,
register it in `src/app.module.ts`, inject it with `@Inject(xScope.KEY)`. See
`src/config-provider/CLAUDE.md`.

**T3 — Every module owns its error type.** An adapter catches the provider SDK's
error and rethrows the module's own error class, so no caller ever depends on
`ioredis`, `@aws-sdk/*` or `resend` internals. Two shapes remain, and they are
the two the template wants (finding `N2`, closed on
`chore/dead-code-and-error-model`; `ApiException` and
`PushNotificationException` are gone): the POJO-constant + `Error`-subclass
form used by `src/cache/abstract/cache.error.ts` for infrastructure, and
`RequestException` for the HTTP layer. Follow the first for a new module.

**T4 — No secrets in code, no secrets in logs.** Secrets come from a config
scope backed by `env` or `sm`. Never log a token, key, password, or raw provider
error. See `src/common/observability/logger/PRACTICES.md`.

**T5 — Imports inside a module are relative.** `../abstract/cache.service` —
never `src/cache/abstract/cache.service`. A module that reaches for an absolute
`src/...` specifier stops working the moment it is copied into another repo.
No file violates this today (findings `N6`/`M1`, closed 2026-09-19); keep it
that way — `pnpm run modularity:check` fails on the first absolute specifier.

**T6 — Named exports, explicit return types, no `any`.** No default exports.
Every function and method declares its return type.
`@typescript-eslint/no-explicit-any` is enforced (it comes from
`tseslint.configs.recommended`, which `eslint.config.mjs` no longer overrides)
and the tree is clean: two `any`s remain in the whole of `src/`, both in
`src/email/abstract/` and both carrying a per-line disable that explains why —
`Record<string, unknown>` rejects interface-typed template params, which have no
implicit index signature. That is the precedent for a new one: a per-line
disable that says what breaks without it, never a file-level disable.

A `forRoot`/`forRootAsync` factory is **not** such a case, even though NestJS's
own `*ModuleAsyncOptions` use `any[]` there. Every abstract module here takes
`<TArgs extends unknown[]>` on the method and threads it into the options
interface, so the tuple is inferred from the factory at the call site and a
typed factory stays assignable — see
`src/analytics/abstract/analytics-abstract.module.ts`. Where there is no call
site to infer from, because the factories sit inside a `Record`, the parameters
are `never[]` and the one place that calls them widens back — see
`src/config-provider/abstract/config-provider.interfaces.ts`.

**T7 — Every module carries its own `CLAUDE.md` and `README.md`, and both
state how to reuse it.** This template is meant to be taken whole *or* module
by module, so a module that does not say what it needs in order to compile
elsewhere is not finished. The `CLAUDE.md` says it for the agent in `## Reuse`;
the `README.md` says it for the human in its own `## Reuse` — the companion
directories it needs, the peer npm packages, what can be dropped, and what
removing it from the template costs. The two describe the same move and must
agree.

A new top-level directory under `src/` is not done until it has both, the guide
built from the skeleton in `docs/architecture/module-contract.md` and listed in
the module map above. `pnpm run docs:check` verifies the map entry, the six
required guide sections, the README beside each guide and its `## Reuse`
heading; it cannot detect a guide that was never written at all, so that part
is on you.

**T8 — Schema changes are migrations, generated by the CLI.** Never hand-write a
migration file, never rely on `DB_SYNCHRONIZE` outside local development. See
`src/database/CLAUDE.md`.

## Conventions

- **Files:** `kebab-case.ts`, suffixed by role — `*.service.ts`, `*.controller.ts`,
  `*.module.ts`, `*.scope.ts`, `*.error.ts`, `*.interfaces.ts`, `*.entity.ts`,
  `*.dto.ts`, `*.const.ts`.
- **Layout of an infrastructure module:** `abstract/` holds the contract, the
  dynamic module, the error type and shared interfaces; `<provider>-adapter/`
  holds one implementation each; `config/` holds that module's scope.
- **Layering:** Controller → Service → Repository. Controllers orchestrate and
  never log (`src/common/observability/logger/PRACTICES.md`); business logic lives in services.
- **DTOs:** `class-validator` decorators plus `@ApiProperty`. The global
  `ValidationPipe` in `src/main.ts` runs with `transform` and
  `forbidNonWhitelisted`.
- **Entities:** extend `src/database/entities/base.entity.ts`. `id` (integer) is
  internal; `uuid` is the only identifier an API response may expose.
- **Tests:** co-located. `*.unit.spec.ts` for isolated unit tests,
  `*.di.spec.ts` for the one spec that boots a real Nest DI container
  (`src/queues/abstract/tests/queue-consumer-feature.module.di.spec.ts`). No
  plain `*.spec.ts` name is left under `src/` — finding `N4` is closed.
- **Git:** branches `feature/` `fix/` `chore/` `hotfix/`; conventional commits;
  PRs only, never a direct push to `master`.

## Before you finish

1. `pnpm run lint`
2. `pnpm test`
3. `pnpm run build`
4. `pnpm run docs:check` if you touched any `CLAUDE.md` or `README.md`
5. `pnpm run modularity:check` if you added, moved or deleted an import that
   crosses a top-level `src/` directory
6. Confirm the diff is minimal and touches no module you were not asked to change.

Those are the same five gates CI runs, with two differences. CI runs `lint:ci`,
not `lint` — `lint` carries `--fix`, so it repairs formatting instead of
failing on it. And CI runs `test:cov`, not `test`: the `coverageThreshold` in
`package.json` only fails the build when coverage is collected, so under plain
`pnpm test` the floor is inert. Run `pnpm run lint:ci` and `pnpm run test:cov`
when you want to know what the pipeline will say.

## Known template-wide gaps

Recorded in `docs/audit/2026-09-11-template-audit.md` (the
`B`/`N`/`D`/`C`/`TS`/`L`/`R`/`G` series) and
`docs/audit/2026-09-18-modularity-audit.md` (the `M`/`EXT`/`DOC` series).
**Read `## Status as of 2026-09-21` at the top of the second file first** — it
is the one place that says what is actually open today. Both audit bodies are
frozen records of the day they were written, annotated in place since.

Every finding in both audits was re-verified against the tree on 2026-09-21:
**51 of 69 are closed.** Of the 2026-09-11 audit's 32, 31 are closed and `N5`
is narrowed but open. Of the 2026-09-18 audit's 37, 20 are closed, 12 remain
(ten of them code defects in one module each, plus `EXT7` and `EXT9`), and
five `EXT` rows are reference measurements rather than defects. The ones that
will bite you first are below.

**Every gate passes.** `docs:check`, `modularity:check`, `lint:ci`, `test:cov`
and `build` were measured green on 2026-09-21 against NestJS 12 and TypeScript
6, along with `tsc --noEmit`: 706 specs across 85 suites, coverage 96.13%
statements / 89.63% branches against a floor of 95 / 88. `pnpm run modularity:check` runs against a zero-violation
baseline (`docs/audit/module-independence-baseline.json`), so it fails on the
first new cross-module violation instead of freezing a known set.

### Open today

- **`H4`** — `test/app.e2e-spec.ts` is 24 lines of Nest scaffold: it boots the
  whole `AppModule` and expects `'Hello World!'` on `GET /`. It needs a live
  database and Redis, so it runs nowhere and CI does not call `test:e2e`.
  **Accepted as debt on 2026-09-21**, deliberately: the template keeps
  promising a suite that proves nothing, and that is the known cost. Closing it
  means either writing real e2e specs with `postgres` and `redis` services in
  `bitbucket-pipelines.yml`, or deleting the file, `test/jest-e2e.json` and the
  `test:e2e` script. Do not half-fix it — a green boilerplate e2e run is worse
  than none.
- **`N5`** — reusable test doubles are still missing from five modules.
  `src/cache/abstract/mocks/`, `src/cloud-storage/abstract/mocks/`,
  `src/email/abstract/mocks/` and `src/push-notification/abstract/mocks/`
  exist; `config-provider`, `queues`, `templating`,
  `common/observability/logger` and `analytics` ship none, so a consumer of any
  of those hand-rolls the double.
- **Rule 4 of the adapter contract is unmet in four modules.** An adapter must
  translate the provider SDK's error into the module's own (`T3`), and these do
  not: `M18` — `src/email/aws-ses-adapter/aws-ses-adapter.service.ts` re-throws
  the raw `@aws-sdk/client-ses` rejection and never imports `EmailError`;
  `M17` — `src/cloud-storage/local-adapter/local-adapter.service.ts` wraps
  neither `mkdir` nor `writeFile` and re-throws every non-`ENOENT` error raw;
  `M12` — `src/templating/pug-adapter/pug-adapter.service.ts` has no
  `try`/`catch` at all, and `templating` ships no error type to translate into;
  `M13`/`M16` — `common/observability/logger` and `analytics` ship no error
  class either, `analytics` by documented fire-and-forget design.
- **Shape deviations, no proven extraction cost.** `M11` — `templating`'s
  `abstract/` holds only the service and a const, with the dynamic module at
  `src/templating/template.module.ts`. `M10` — `queues` splits the contract
  across `abstract/producer/` and `abstract/consumer/`; deliberate, documented
  in `src/queues/CLAUDE.md`, and the bespoke root module it used to carry is
  gone. `M14` — `src/push-notification/expo-adapter/expo-adapter.service.ts` is
  the one adapter decorating its config parameter with `@Inject`. `M8` — the
  `TIERS` map in `scripts/check-module-independence.mjs` tiers `database` as
  `infrastructure` and `templates` as `feature`; both calls are disputed and
  neither currently masks a violation.
- **`EXT7` — `common` has an extraction dependency no import graph can see.**
  `src/common/middleware/response.interceptor.ts` reads `user.id`, which type-
  checks only because the repo root ships `@types/express/index.d.ts` and
  `tsconfig.json` declares no `include`, so every `.d.ts` under the project
  root is compiled. Copying `common` elsewhere means copying that file *and*
  landing it somewhere the destination's `tsconfig.json` actually covers.
  `src/common/CLAUDE.md` and `src/common/README.md` both say so now. `EXT9` is
  the general form: a green `modularity:check` is not proof a module extracts
  cleanly.
- **RabbitMQ and SQS are complete but unwired.** Only BullMQ is registered in
  `src/app.module.ts`. Deliberate — three brokers registered at once means
  three live connections for one queue. `src/queues/README.md`'s *Switching the
  template's broker* has the exact edit for each.
- **Extraction cost is measured for one module only.** `queues` was re-measured
  on 2026-09-19 after the discovery that a fresh `@nestjs/cli` scaffold is ESM
  while this template emits CommonJS — which is what made the earlier probes
  measure the wrong thing. It closes at two companions,
  `src/common/observability/logger/` and `src/config-provider/`
  (`docs/audit/evidence/extract-queues-closure-2026-09-19.txt`). `cache`
  (`EXT1`, `EXT6`) and `email` (`EXT2`, `EXT5`) date from 2026-09-18 and
  predate that correction; the other twelve top-level directories have never
  been copied into a clean project and compiled. **Left open knowingly, by team
  decision on 2026-09-21.** Do not quote a per-module extraction cost outside
  `queues` as measured.

  Every one of those numbers is now also older than the toolchain. The
  2026-09-21 Nest 12 upgrade moved this repo to `"module": "nodenext"`, which
  is what `nest new --type cjs` emits, so the scaffold and the template now
  differ only by `"type": "module"` — the gap the 2026-09-19 evidence file
  describes is narrower than it records. Re-measuring was not part of that
  work.

### Closed, kept here because they are cited

- **`B1`** — ~~`src/app.module.ts` does not compile: `emailConfig`, `awsConfig` and
  `ConfigType` are referenced but never imported.~~ **Fixed on `fix/build-and-lint`.**
- **`B2`** — ~~`package.json` declares `dotenv` twice.~~ **Fixed** — declared once.
- **`B3`** — ~~`Dockerfile` uses `apk` on a Debian image and runs `prisma generate`
  in a TypeORM project.~~ **Fixed on `fix/container-and-deploy-build`:** the image
  installs `dumb-init` with `apt-get` and no Prisma call remains in `Dockerfile`
  or `docker-script.sh`.
- **`L1`** — ~~`pnpm run lint` exits 1 with 23 errors, so the pipeline is red on
  every PR, because `eslint.config.mjs` spreads the recommended configs *after*
  its own rules block.~~ **Fixed on `fix/build-and-lint`** for the 23 errors;
  the ordering half was fixed on `chore/eslint-flat-config` (`H1`).
- **`L3`** — ~~the `lint` script runs with `--fix` and CI runs that script, so CI
  cannot detect formatting drift.~~ **Fixed on `chore/ci-test-gate`:** the tree
  is Prettier-clean, `lint` keeps `--fix` for local use, and CI runs `lint:ci`.
- **`G2`** — ~~CI never runs `pnpm test`.~~ **Fixed on `chore/ci-test-gate`:** the
  `test-build` step runs `pnpm test` between `lint:ci` and `build`, and runs on
  `staging` and `master` before their deploy step as well as on pull requests.
  `test:e2e` is still not in the pipeline — that is `H4`, above.
- **`TS1`** — ~~`tsconfig.json` is not in strict mode.~~ **Fixed on
  `chore/typescript-strict`:** `"strict": true` is on and `tsc --noEmit` is
  clean. `TS2` and `TS3` closed with it; the `any` half closed on
  `refactor/no-explicit-any` — two remain, both documented (`T6`).
- **`M1`-`M7`, `N6`** — ~~absolute `src/...` imports, the `(app)`/`queues`/`spaceship`
  cycle, and the `auth`/`database` and `common`/`config-provider` cycles.~~
  **Fixed on `feature/queues-decoupling` (2026-09-19):** the graph has zero
  violations and zero cycles.
- **`C1`-`C5`, `D1`-`D5`, `N1`-`N4`, `N7`, `R1`-`R4`, `G1`, `M15`, `DOC1`-`DOC10`**
  — all closed; each is struck with its own evidence in the audit files.

Do not fix the open ones opportunistically as part of unrelated work. They are
tracked; raise them, scope them, fix them deliberately.
