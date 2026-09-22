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
| `src/spaceship` | `src/spaceship/CLAUDE.md` | `src/spaceship/README.md` |

One shared reference lives outside a module guide:
`src/common/observability/logger/PRACTICES.md`, which is binding on every log
line written anywhere in the tree.

Nothing else in this repository documents its own past. There are no audit
files, no finding IDs and no plan documents, deliberately: a module is copied
into another project on its own, and a guide that cites a path outside its
directory becomes a dangling pointer the moment it lands there. Each guide
states what its module does, how to implement against it, and what it needs in
order to compile elsewhere. History belongs in `git log`.

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
pnpm run db:migration:generate src/database/migrations/<Name>
pnpm run db:migration:run
pnpm run db:migration:revert
```

No `--` before the migration path. pnpm 10 consumes it when what follows is a
positional argument, and TypeORM then fails with `Not enough non-option
arguments: got 0, need at least 1`. A flag survives it, which is why
`pnpm run modularity:check -- --report` still works as written elsewhere.

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

**TypeScript 6 changed three defaults this repo depends on.** It no longer
auto-includes `@types/*` packages, so they are named in
`"types": ["node", "jest"]` — add to that list when you add a global type
package, or it silently will not load. It no longer infers `rootDir`
(TS5011), so the base config pins `"."` and `tsconfig.build.json` narrows it to
`"./src"` to keep the emitted layout at `dist/main.js`. And it writes the
`.tsbuildinfo` incremental record beside the config instead of inside `outDir`,
which is why both build configs name their own `tsBuildInfoFile` under `dist`:
`prebuild` is `rimraf dist`, so a record left outside survives the wipe, the
next `tsc` reads it, concludes everything is already emitted and writes
nothing — and `nest build` exits 0 having produced an empty output directory.
A new build config needs its own `tsBuildInfoFile`, never a shared one.

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

One exception exists, and it is the only one:
`src/spaceship/notification/notification.module.ts` aliases
`BullMqProducerAdapter` behind an `instanceof` guard, because its job needs
BullMQ's `attempts`/`backoff` and the abstract `QueueProducerService` exposes
only broker-agnostic `delay`/`priority`. `src/queues/CLAUDE.md`'s Rule 1
sanctions exactly this and requires the consuming module's guide to declare it
— `src/spaceship/CLAUDE.md` does. Follow that shape, guard included, or do not
take the exception at all: a bare `useExisting` alias turns a broker swap into
a runtime failure inside the request path instead of a failure at startup.

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
`ioredis`, `@aws-sdk/*` or `resend` internals. Exactly two shapes exist here,
and a third is not welcome: the POJO-constant + `Error`-subclass
form used by `src/cache/abstract/cache.error.ts` for infrastructure, and
`RequestException` for the HTTP layer. Follow the first for a new module.

**T4 — No secrets in code, no secrets in logs.** Secrets come from a config
scope backed by `env` or `sm`. Never log a token, key, password, or raw provider
error. See `src/common/observability/logger/PRACTICES.md`.

**T5 — Imports inside a module are relative.** `../abstract/cache.service` —
never `src/cache/abstract/cache.service`. A module that reaches for an absolute
`src/...` specifier stops working the moment it is copied into another repo.
No file violates this today; keep it that way —
`pnpm run modularity:check` fails on the first absolute specifier.

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
following the section order every other guide uses — `## Scope`,
`## Public surface`, `## Rules`, `## Tests`, `## Reuse`, `## Known gaps` — and
listed in the module map above. `pnpm run docs:check` verifies the map entry, the six
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
  `ValidationPipe` in `src/main.ts` runs with `transform`, `whitelist` and
  `forbidNonWhitelisted`, so **a request carrying a property no DTO declares is
  rejected with `400`, on every endpoint.** That became true on 2026-09-22:
  before it, `forbidNonWhitelisted` stood without `whitelist`, which is inert,
  and an undeclared field was accepted silently. A project that took this
  template earlier and sends extra fields will see the difference at runtime.
- **Entities:** extend `src/database/entities/base.entity.ts`. `id` (integer) is
  internal; `uuid` is the only identifier an API response may expose.
- **Tests:** co-located. `*.unit.spec.ts` for isolated unit tests,
  `*.di.spec.ts` for a spec that boots a real Nest DI container — there are two,
  `src/queues/abstract/tests/queue-consumer-feature.module.di.spec.ts` and
  `src/spaceship/spaceship.module.di.spec.ts`, and they are the two ends of the
  same wiring. No plain `*.spec.ts` name is left under `src/`.
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

These hold across the template today. Each one is also stated in the guide of
the module it belongs to; they are collected here because they shape what you
can promise a project that adopts this repo.

**The e2e suite proves nothing.** `test/app.e2e-spec.ts` is the unmodified Nest
scaffold: it boots the whole `AppModule` and expects `'Hello World!'` on
`GET /`, so it needs a live database and Redis and runs nowhere — not locally
by default, and not in CI, which does not call `test:e2e`. This is accepted
debt, not an oversight. Closing it means either writing real e2e specs with
`postgres` and `redis` services in `bitbucket-pipelines.yml`, or deleting the
file, `test/jest-e2e.json` and the script. Do not half-fix it: a green
boilerplate e2e run is worse than none.

**Three adapters do not translate their provider's errors,** against `T3`.
`src/email/aws-ses-adapter/` re-throws the raw `@aws-sdk/client-ses` rejection;
`src/cloud-storage/local-adapter/` wraps neither `mkdir` nor `writeFile` and
re-throws every non-`ENOENT` failure raw; `src/templating/pug-adapter/` has no
`try`/`catch` at all, and `templating` ships no error type to translate into in
the first place. `common/observability/logger` and `analytics` ship no error
class either — analytics by design, since capture is fire-and-forget.

**Five modules ship no reusable test doubles.** `cache`, `cloud-storage`,
`email` and `push-notification` have `abstract/mocks/`; `config-provider`,
`queues`, `templating`, `common/observability/logger` and `analytics` do not, so
a consumer of any of those hand-rolls its own.

**A green `modularity:check` is not proof a module extracts cleanly.** The
checker reads import specifiers, and not every coupling has one — `src/common/`
depends on an ambient type declared in the repo-root `@types/` directory that no
import statement names. Extraction has been measured, by copying the directory
into a clean project and compiling, for `cache`, `email` and `queues` only. Do
not quote a companion count for any other module as measured.

**Three modules deviate from the shape the rest share.** `templating`'s
`abstract/` holds only the service and a const, with its dynamic module at the
module root; `queues` splits its contract across `abstract/producer/` and
`abstract/consumer/` because it is the one bidirectional module here;
`push-notification` uses style-B registration and decorates its adapter's config
parameter with `@Inject`. All three are documented where they live. Copy
`src/cache/` instead — it is the reference shape.

**RabbitMQ and SQS are complete but unwired.** Only BullMQ is registered in
`src/app.module.ts`, deliberately: three brokers registered at once means three
live connections for one queue. `src/queues/README.md`'s *Switching the
template's broker* has the exact edit for each.

**The five gates pass.** `docs:check`, `modularity:check`, `lint:ci`, `test:cov`
and `build` are green, as is `tsc --noEmit` under `"strict": true`. The coverage
floor is 95% statements, 88% branches, 94% functions and 95% lines, set just
under the real numbers so it fails on a regression rather than on ambition.
`modularity:check` runs against a zero-violation baseline
(`scripts/module-independence-baseline.json`), so it fails on the first new
cross-module violation instead of freezing a known set.

**Three defects reached `master` because only running the application found
them:** a consumer option passed as `undefined` that stopped every worker from
starting, a provider client built eagerly with empty config that stopped the app
booting from its own `.env.example`, and a `ValidationPipe` option that was
inert without its companion. A green `test:cov` saw none of them, because each
sat in wiring that the specs mock. When you add an optional adapter option or a
provider client, boot the app before believing the suite.
