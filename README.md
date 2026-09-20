# SpaceDev NestJS Template

SpaceDev's reusable NestJS backend template. It exists to serve two
workflows: [lift one module into an existing project](#use-a-module-in-another-project),
or [clone the whole thing and delete what you don't need](#clone-the-template-and-strip-what-you-dont-need).
See below for what that means and how to work with it.

## SpaceDev template documentation

This is the SpaceDev reusable NestJS template. Each top-level directory under
`src/` is a module designed to be lifted into another project on its own.

- `CLAUDE.md` — project invariants, commands and the module map. Start here.
- `docs/architecture/module-contract.md` — the contract every adapter module implements.
- `docs/audit/2026-09-11-template-audit.md` — known defects, cited by ID from each module guide.
- `docs/audit/2026-09-18-modularity-audit.md` — the modularity/extraction/documentation findings, and its reconciliation of the older audit.
- `src/<module>/CLAUDE.md` — rules, public surface and extraction recipe for that module.
- `src/<module>/README.md` — human-facing recipes and examples for that module.

Run `pnpm run docs:check` after editing any `CLAUDE.md`.

## Use a module in another project

The general recipe:

1. Copy `src/<module>/` into the destination project.
2. Copy each companion directory that module depends on (see below) into the
   destination's `src/`.
3. If `common` is one of those companions, also copy the repo-root `@types/`
   directory and add `"typeRoots": ["@types", "./node_modules/@types"]` to the
   destination's `tsconfig.json`. `common` depends on the ambient `Express.User`
   type declared there — see `src/common/CLAUDE.md`'s `## Reuse` section for
   the details, since this is the dependency with no import statement, so no
   amount of reading the source will surface it. (The
   `src/common/observability/logger/` subtree on its own does not need it: the
   queues measurement below compiled clean without `typeRoots`.)
4. Install the module's npm packages (below).
5. Register the module in the destination's `src/app.module.ts`, the way this
   template's own `src/app.module.ts` does.

**Prerequisite — the destination's module system.** A project scaffolded today
by `@nestjs/cli@latest` (measured 2026-09-19 against `@nestjs/cli` 12.0.3 and
TypeScript 6.0.3) is ESM: `"type": "module"` in `package.json` and
`"module"`/`"moduleResolution": "nodenext"` in `tsconfig.json`. That resolution
mode requires an explicit `.js` extension on every relative import. This
template is CommonJS — `tsconfig.json` sets `"module": "commonjs"` and
`package.json` has no `"type"` field — and none of its source writes
extensioned relative imports, so **no module from this template compiles in a
default modern scaffold** until the destination either sets
`"module": "commonjs"` or every relative import in the copied code gains a
`.js` extension. This affects every module, not just the ones below. Evidence:
`docs/audit/evidence/extract-queues-2026-09-19.txt`.

What that costs, measured by copying each module alone into a fresh `nest new`
project and running `tsc --noEmit`. The 2026-09-19 `queues` run is not
reproducible from a bare `nest new` any more: the scaffold was first aligned to
this template's CommonJS settings, for the reason given in the prerequisite
above, before any template code was copied in.

- **`cache`** lifts with **zero** companion directories — `tsc --noEmit` exits
  0 (`EXT1`). Needs the npm package `ioredis`. Measured 2026-09-18
  (`docs/audit/2026-09-18-modularity-audit.md`, `### Extraction`).
- **`email`** lifts with **two** companions, `common` and `config-provider`
  (`EXT5`). Needs `resend`, `@sendgrid/mail`, `@aws-sdk/client-ses`, `joi`.
  Measured 2026-09-18, same source.
- **`queues`** lifts with **two** companions,
  `src/common/observability/logger/` and `src/config-provider/`. Copying
  `src/queues/` alone leaves **19** unresolved imports; with both companions
  `tsc --noEmit` exits 0. `src/queues/` itself needs `bullmq`, `amqplib`
  (plus `@types/amqplib`), `@aws-sdk/client-sqs` and `joi`, plus
  `@types/jest` if you copy its `tests/` folders — 11 of those 19 errors are
  in spec files, 8 are not; the companions
  bring their own — `class-transformer`, `pino`, `winston`,
  `@opentelemetry/api` and `@opentelemetry/sdk-trace-node` for the logger,
  `@aws-sdk/client-secrets-manager` and `dotenv` for `config-provider`.
  Measured 2026-09-19: `docs/audit/evidence/extract-queues-2026-09-19.txt`
  and `extract-queues-closure-2026-09-19.txt`.

The `cache` and `email` figures were measured on 2026-09-18 and have not been
re-verified since; in particular they predate the scaffold change described
above, which was only discovered during the 2026-09-19 `queues` measurement.

`queues` is the one that changed. On 2026-09-18 it **did not lift** at all:
copying it alone left 29 unresolved imports, and the only closure that
compiled pulled in 11 of the template's 13 top-level `src/` directories
(`EXT3`, `EXT4`). Removing the demo domain module and moving consumer
registration to `QueueConsumerModule.forFeature` brought that down to the two
companions above.

**This measures compile time, not boot time.** Every result above means
`tsc --noEmit` exits 0 — it does not mean the lifted module works once
running. Whether, say, `cache`'s `forRootAsync` resolves when the host project
registers no matching config scope is untested; the audit does not answer it,
and neither does this README.

## Clone the template and strip what you don't need

The other supported workflow: clone the repository and delete what you don't
need, keeping the rest wired together.

There is no demo domain module to delete. What comes out cleanly is a module no
other module imports: the seven adapter modules `analytics`, `cache`,
`cloud-storage`, `email`, `push-notification`, `queues` and `templating`, and
also `auth`, which is not an adapter module but has no inbound edges either
(removing it leaves `database` and `user` with no importers left). Each of
those is removed with the same three edits:

1. Remove its registration from `src/app.module.ts`.
2. Remove its config scope from that file's `scopes` array. `templating`
   registers none; `cache` and `queues` share `src/redis.scope.ts`, so that one
   goes only when both have.
3. Remove its variables from `.env.example`.

The rest of the tree is not free-standing. `pnpm run modularity:check --
--report` prints the edges that say so, and today they are:

- `common` is imported by `analytics`, `auth`, `cloud-storage`,
  `config-provider`, `email`, `queues` and `templating`.
- `config-provider` is imported by `analytics`, `auth`, `cloud-storage`,
  `database`, `email`, `push-notification` and `queues` — and imports `common`
  itself.
- `database` is imported by `auth` (13 specifiers).
- `src/user/current-user.decorator.ts` is imported by
  `src/auth/google/google.controller.ts`.

So `common`, `config-provider`, `database` and `user` do not come out on their
own: deleting any of them while something above still imports it leaves the
tree non-compiling. They go last, once everything that imports them has gone.

Two directories fit neither list, having no registration and no config scope in
`src/app.module.ts`:

- `src/templates/` holds two generic templates, `WELCOME` and `VERIFICATION`,
  registered in `src/templates/template.const.ts`. Both are starting points, not
  demo content — there is nothing here to strip. No module imports it; only
  `src/app.controller.ts` does, for `TEMPLATE_PATHS`.
- `src/user/` is a single file, not a module: `current-user.decorator.ts`,
  live per the edge above. The empty `user.module.ts` that used to sit beside
  it was deleted (finding `R3`).

Run `pnpm run modularity:check -- --report` for the current dependency graph
before deleting anything, rather than trusting a copy of it that will drift.

## Installation

```bash
$ pnpm install
```

## Local development

This project needs PostgreSQL and Redis running locally. Start both with:

```bash
docker-compose up -d
```

Redis backs the BullMQ background job queues: `src/app.module.ts` wires both
the producer and the consumer adapter against it, even though the template
ships no queue handlers of its own. See `REDIS_HOST` / `REDIS_PORT` /
`REDIS_PASSWORD` in `.env.example`. The app depends on Redis at runtime, not
just in tests.

## Running the app

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Test

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Gates CI runs on every PR

```bash
$ pnpm run docs:check
$ pnpm run modularity:check
$ pnpm run lint
$ pnpm run build
```
