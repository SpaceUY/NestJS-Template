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
| `src/common/logger` | `src/common/logger/CLAUDE.md` | `src/common/logger/README.md` |
| `src/database` | `src/database/CLAUDE.md` | — |
| `src/auth` | `src/auth/CLAUDE.md` | — |
| `src/cache` | `src/cache/CLAUDE.md` | `src/cache/README.md` |
| `src/cloud-storage` | `src/cloud-storage/CLAUDE.md` | `src/cloud-storage/README.md` |
| `src/email` | `src/email/CLAUDE.md` | `src/email/README.md` |
| `src/push-notification` | `src/push-notification/CLAUDE.md` | `src/push-notification/README.md` |
| `src/templating` | `src/templating/CLAUDE.md` | `src/templating/README.md` |
| `src/templates` | `src/templates/CLAUDE.md` | `src/templates/README.md` |
| `src/queues` | `src/queues/CLAUDE.md` | `src/queues/README.md` |
| `src/spaceship` | `src/spaceship/CLAUDE.md` | — |

`src/user` has no guide — it holds `src/user/current-user.decorator.ts` plus an
empty `src/user/user.module.ts` that nothing imports (finding `R3`).

Shared references: `docs/architecture/module-contract.md` (the adapter-module
contract), `docs/audit/2026-09-11-template-audit.md` (known defects),
`src/common/logger/PRACTICES.md` (logging rules).

## Commands

```bash
pnpm install                  # pnpm 10.15.1, Node 24.15.0 — never npm or yarn
pnpm run start:dev            # watch mode
pnpm run build                # nest build
pnpm test                     # jest, rootDir src, testRegex .*\.spec\.ts$
pnpm run test:e2e             # jest --config ./test/jest-e2e.json
pnpm run lint                 # eslint --fix
pnpm run docs:check           # validates every CLAUDE.md
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
`process.env` outside `src/config-provider/env-adapter/env-config.adapter.ts`
and `src/database/data-source.ts` (the TypeORM CLI entry point, which runs
outside the Nest container). Define a scope with `defineConfigScope`, validate
it with Joi, register it in `src/app.module.ts`, inject it with
`@Inject(xScope.KEY)`. See `src/config-provider/CLAUDE.md`.

**T3 — Every module owns its error type.** An adapter catches the provider SDK's
error and rethrows the module's own error class, so no caller ever depends on
`ioredis`, `@aws-sdk/*` or `resend` internals. The template currently has four
competing error shapes — finding `N2`; the POJO-constant + `Error`-subclass form
used by `src/cache/abstract/cache.error.ts` is the one to follow for new work.

**T4 — No secrets in code, no secrets in logs.** Secrets come from a config
scope backed by `env` or `sm`. Never log a token, key, password, or raw provider
error. See `src/common/logger/PRACTICES.md`.

**T5 — Imports inside a module are relative.** `../abstract/cache.service` —
never `src/cache/abstract/cache.service`. A module that reaches for an absolute
`src/...` specifier stops working the moment it is copied into another repo.
Four files still violate this (finding `N6`); do not add a fifth.

**T6 — Named exports, explicit return types, no `any`.** No default exports.
Every function and method declares its return type.
`@typescript-eslint/no-explicit-any` is enforced and the tree is clean: no new
`any` without a per-line disable that explains why, following the precedent in
`src/config-provider/abstract/config-provider.interfaces.ts`.

**T7 — Every module carries its own `CLAUDE.md`.** A new top-level directory
under `src/` is not done until it has one, built from the skeleton in
`docs/architecture/module-contract.md` and listed in the module map above.
`pnpm run docs:check` verifies that every guide which exists is listed in the
map; it cannot detect a guide that was never written, so that part is on you.

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
  never log (`src/common/logger/PRACTICES.md`); business logic lives in services.
- **DTOs:** `class-validator` decorators plus `@ApiProperty`. The global
  `ValidationPipe` in `src/main.ts` runs with `transform` and
  `forbidNonWhitelisted`.
- **Entities:** extend `src/database/entities/base.entity.ts`. `id` (integer) is
  internal; `uuid` is the only identifier an API response may expose.
- **Tests:** co-located, `*.unit.spec.ts` for isolated unit tests. The four
  `*.spec.ts` files are legacy (finding `N4`); new tests use `*.unit.spec.ts`.
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

**`pnpm run build` and `pnpm run lint` both fail on `master` right now.** That is
still true there; both pass on `fix/build-and-lint`.

- **`B1`** — ~~`src/app.module.ts` does not compile: `emailConfig`, `awsConfig` and
  `ConfigType` are referenced but never imported. Six TypeScript errors.~~ **Fixed on `fix/build-and-lint`.**
- **`L1`** — ~~`pnpm run lint` exits 1 with 23 errors, so the pipeline is red on
  every PR. `eslint.config.mjs` spreads the recommended configs *after* its own
  rules block, which silently re-enables `@typescript-eslint/no-explicit-any`.~~ **Fixed on `fix/build-and-lint`.**
- **`L3`** — ~~the `lint` script runs with `--fix`, so invoking it rewrites 20
  files with Prettier formatting. **Check `git status` after linting** and do not
  commit that reformat alongside unrelated work.~~ **Partially fixed:** the tree is Prettier-clean now, so linting no longer hands you a 20-file diff. Still open: `lint` keeps `--fix` and CI runs it, so CI cannot detect future drift.
- **`B2`** — `package.json` declares `dotenv` twice.
- **`B3`** — `Dockerfile` uses `apk` on a Debian image and runs `prisma generate`
  in a TypeORM project.
- **`G2`** — CI runs lint and build only; `pnpm test` never runs in the pipeline,
  even though all 120 tests pass.
- **`TS1`** — `tsconfig.json` is not in strict mode, contrary to the SpaceDev
  standard.

Do not fix these opportunistically as part of unrelated work. They are tracked;
raise them, scope them, fix them deliberately.
