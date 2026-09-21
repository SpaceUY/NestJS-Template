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
`ioredis`, `@aws-sdk/*` or `resend` internals. The template currently has four
competing error shapes — finding `N2`; the POJO-constant + `Error`-subclass form
used by `src/cache/abstract/cache.error.ts` is the one to follow for new work.

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
4. `pnpm run docs:check` if you touched any `CLAUDE.md`
5. Confirm the diff is minimal and touches no module you were not asked to change.

## Known template-wide gaps

Recorded in `docs/audit/2026-09-11-template-audit.md`. The ones that will bite
you first:

**All four gates pass on `master`.** `build`, `eslint`, `test` and `docs:check`
were measured green in `docs/audit/2026-09-18-modularity-audit.md`'s gate table;
`pnpm run modularity:check` gates the module graph as of that audit. The
`fix/build-and-lint` branch this section used to point at has landed.

- **`B1`** — ~~`src/app.module.ts` does not compile: `emailConfig`, `awsConfig` and
  `ConfigType` are referenced but never imported. Six TypeScript errors.~~ **Fixed on `fix/build-and-lint`.**
- **`L1`** — ~~`pnpm run lint` exits 1 with 23 errors, so the pipeline is red on
  every PR. `eslint.config.mjs` spreads the recommended configs *after* its own
  rules block, which silently re-enables `@typescript-eslint/no-explicit-any`.~~
  **Fixed on `fix/build-and-lint`** for the 23 errors. The ordering half
  outlived it and was only fixed on `chore/eslint-flat-config` (see `H1`): the
  shared configs now come first and the project block last, so what the file
  says is what ESLint does.
- **`L3`** — ~~the `lint` script runs with `--fix`, so invoking it rewrites 20
  files with Prettier formatting, and CI runs that script — so CI cannot detect
  formatting drift.~~ **Fixed on `chore/ci-test-gate`:** the tree is
  Prettier-clean, `lint` keeps `--fix` for local use, and CI now runs the new
  `lint:ci` script (`eslint` without `--fix`), which fails on drift instead of
  silently repairing it.
- **`B2`** — ~~`package.json` declares `dotenv` twice.~~ **Fixed** — declared
  once; verified in `docs/audit/2026-09-18-modularity-audit.md` (`DOC5`).
- **`B3`** — ~~`Dockerfile` uses `apk` on a Debian image and runs `prisma generate`
  in a TypeORM project.~~ **Fixed on `fix/container-and-deploy-build`:** the
  image installs `dumb-init` with `apt-get`, the Prisma calls are gone from
  both `Dockerfile` and `docker-script.sh` (the entrypoint now runs
  `pnpm run db:migration:run`), and `bitbucket-pipelines.yml`'s deploy step
  installs `gettext-base` with `apt-get` too. Verified by building the image.
- **`G2`** — ~~CI runs `docs:check`, `modularity:check`, `lint` and `build`;
  `pnpm test` never runs in the pipeline.~~ **Fixed on `chore/ci-test-gate`:**
  the `test-build` step runs `pnpm test` between `lint:ci` and `build`, and that
  step now also runs on the `staging` and `master` branches before their deploy
  step — a pull-request build proves the merge source, not the merged result.
  Still true, and deliberate: `pnpm run test:e2e` does not run —
  `test/app.e2e-spec.ts` is unmodified Nest boilerplate and needs a live
  database.
- **`H4`** — `test/app.e2e-spec.ts` is 24 lines of Nest scaffold: it boots the
  whole `AppModule` and expects `'Hello World!'` on `GET /`. It needs a live
  database and Redis, so it runs nowhere. **Accepted as debt on 2026-09-21**,
  deliberately: the template keeps promising a suite that proves nothing, and
  that is the known cost. Closing it means either writing real e2e specs with
  `postgres` and `redis` services in `bitbucket-pipelines.yml`, or deleting the
  file, `test/jest-e2e.json` and the `test:e2e` script. Do not half-fix it — a
  green boilerplate e2e run is worse than none.
- **`TS1`** — ~~`tsconfig.json` is not in strict mode, contrary to the SpaceDev
  standard.~~ **Fixed on `chore/typescript-strict`:** `"strict": true` is on,
  `noImplicitAny` and `strictBindCallApply` no longer opt out, and
  `pnpm exec tsc --noEmit` reports zero errors. `TS2` (untyped `validate`
  parameters) and `TS3` (`typescript-eslint` under `dependencies`) closed with
  it. The `any` half closed separately on `refactor/no-explicit-any`: the 46
  annotations are down to 2, both documented exceptions in
  `src/email/abstract/` (see `T6`). The rule was never actually `'off'` —
  `eslint.config.mjs` said so in a block the recommended config overrode, which
  is why the tree carried 31 `eslint-disable` directives for a rule its own
  config claimed to have disabled. Both are gone.

Do not fix these opportunistically as part of unrelated work. They are tracked;
raise them, scope them, fix them deliberately.
