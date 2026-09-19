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
   amount of reading the source will surface it.
4. Install the module's npm packages (below).
5. Register the module in the destination's `src/app.module.ts`, the way this
   template's own `src/app.module.ts` does.

What that costs, measured by copying each module alone into a fresh `nest new`
project and running `tsc --noEmit` (`docs/audit/2026-09-18-modularity-audit.md`,
`### Extraction`):

- **`cache`** lifts with **zero** companion directories — `tsc --noEmit` exits
  0 (`EXT1`). Needs the npm package `ioredis`.
- **`email`** lifts with **two** companions, `common` and `config-provider`
  (`EXT5`). Needs `resend`, `@sendgrid/mail`, `@aws-sdk/client-ses`, `joi`.
- **`queues`** does not lift: copying `src/queues/` alone leaves 29 unresolved
  imports, and the only closure that compiles pulls in 11 of the template's 13
  top-level `src/` directories plus the app-root `src/redis.scope.ts`
  (`EXT3`, `EXT4`). See `src/queues/README.md`'s `## Reuse` section for what
  actually lifts out of it and what to write instead.

**This measures compile time, not boot time.** Every result above means
`tsc --noEmit` exits 0 — it does not mean the lifted module works once
running. Whether, say, `cache`'s `forRootAsync` resolves when the host project
registers no matching config scope is untested; the audit does not answer it,
and neither does this README.

## Clone the template and strip what you don't need

The other supported workflow: clone the repository and delete the modules you
don't need, keeping the rest wired together.

`src/spaceship/` is a demo, not infrastructure — it is the reference domain
module the rest of the template is written against. Its own guide says so
directly (`src/spaceship/CLAUDE.md:90`): "Do not copy this module into a
project. Delete it, and copy its *shape*."

`src/templates/` is only partly demo. `src/templates/template.const.ts`
registers three templates: `WELCOME` and `VERIFICATION` are generic and
should stay; `SPACESHIP_CREATED` belongs to `spaceship` and should go with
it, along with the files it points to under `src/templates/spaceship/` and
its entries in the `TEMPLATES`, `TEMPLATE_PATHS` and `TEMPLATE_SUBJECTS`
maps.

Deleting `spaceship` means editing two other files by hand. `src/app.module.ts`
references it in six places: the import (line 32), its two config-scope
imports (lines 55-56), both scope registrations (lines 80-81), and the module
registration itself (line 98). `.env.example` declares two spaceship-specific
variables: `NOTIFICATION_EMPLOYEE_EMAILS` (line 32) and
`SPACESHIP_LIST_CACHE_TTL_SECONDS` (line 33).

`spaceship` can't just be deleted, either — `src/queues/queues.module.ts`
imports its notification code, which closes a three-way import cycle among
the app root, `queues` and `spaceship` (`M2`, `M3`, `M5`). Deleting
`spaceship` without first removing that import from `queues.module.ts` breaks
`queues`. This coupling is a known, tracked defect that this documentation
change does not fix — run `pnpm run modularity:check -- --report` for the
current dependency graph before deleting anything, rather than trusting a
copy of it that will drift.

`src/user/` is two unrelated files, not one module: `src/user/user.module.ts`
is an empty module that nothing imports, safe to delete on its own.
`src/user/current-user.decorator.ts` is live — `src/auth/google/google.controller.ts`
imports it directly — so it stays even after `spaceship` (which also uses it)
is gone.

## Installation

```bash
$ pnpm install
```

## Local development

This project needs PostgreSQL and Redis running locally. Start both with:

```bash
docker-compose up -d
```

Redis backs the BullMQ background job queues (e.g. the spaceship-created
email notification) — see `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` in
`.env.example`. The app depends on Redis at runtime, not just in tests.

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
