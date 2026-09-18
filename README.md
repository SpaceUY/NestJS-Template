# SpaceDev NestJS Template

A SpaceDev reusable NestJS backend template. Every top-level directory under
`src/` is a module built so it can be lifted into another repository on its
own.

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
```
