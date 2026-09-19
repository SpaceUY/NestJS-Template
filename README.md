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

**This measures compile time, not boot time.** Every result above means
`tsc --noEmit` exits 0 — it does not mean the lifted module works once
running. Whether, say, `cache`'s `forRootAsync` resolves when the host project
registers no matching config scope is untested; the audit does not answer it,
and neither does this README.

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
