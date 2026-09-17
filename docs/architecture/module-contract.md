# Adapter module contract

Every infrastructure module in this template — `cache`, `cloud-storage`,
`email`, `push-notification`, `templating`, `config-provider`,
`common/observability/logger` — implements the same shape. This document defines it once so
module `CLAUDE.md` files do not restate it.

## The shape

```text
src/<module>/
├── abstract/
│   ├── <module>.service.ts          abstract class — the DI token and contract
│   ├── <module>.interfaces.ts       shared types
│   ├── <module>.error.ts            error-code constant + Error subclass
│   ├── <module>-abstract.module.ts  dynamic module: forRoot / forRootAsync
│   └── mocks/                       reusable jest doubles
├── <provider>-adapter/
│   ├── <provider>-adapter-config.interface.ts
│   └── <provider>-adapter.service.ts   extends the abstract service
├── config/
│   └── <module>.scope.ts            config scope, if the module needs config
├── CLAUDE.md
└── README.md
```

## The five rules

1. **The abstract class is the injection token.** NestJS resolves by class
   reference, so `providers: [{ provide: CacheService, useClass: adapter }]`
   makes `constructor(private readonly cache: CacheService)` work in any
   consumer. No string token is needed for the main contract.
2. **An adapter is a plain class extending the abstract service.** It takes its
   configuration through its constructor and knows nothing about NestJS
   modules. This is what makes it unit-testable with `new AdapterService(cfg)`
   and no testing module.
3. **The abstract module exposes `forRoot` and `forRootAsync`.** `forRoot`
   binds an adapter class (`useClass`) for adapters with no runtime config;
   `forRootAsync` takes `{ imports?, inject?, useFactory, isGlobal? }` and is
   the path for anything config-dependent. Both accept `isGlobal`.
   `forRootAsync` is the default choice.
4. **Adapters translate errors.** Catch the provider SDK error, throw the
   module's own error class carrying a code from the module's constant map.
   `src/cache/redis-adapter/redis-adapter.service.ts` is the reference.
5. **The module ships mocks.** `abstract/mocks/` exports a jest-backed double
   per abstract class so consumers test against the contract rather than
   hand-rolling a stub. `src/cache/abstract/mocks/cache.service.mock.ts` is the
   reference; it is currently the only one (finding `N5`).

## The two registration styles

The template contains both. New modules use style A.

**Style A — adapter as class** (`email`, `cloud-storage`, `common/observability/logger`,
`cache`). The abstract module binds the adapter class or a factory directly:

```ts
EmailAbstractModule.forRootAsync({
  isGlobal: true,
  inject: [emailScope.KEY],
  useFactory: (email: EmailScopeConfig) =>
    new ResendAdapterService({ resendApiKey: email.resendApiKey, emailFrom: email.from }),
});
```

**Style B — adapter as module** (`push-notification`, `templating`). The adapter
ships its own `register`/`registerAsync` dynamic module that binds a provider
token; the abstract module imports it and aliases the token to the abstract
class. It exists because those adapters were written before style A settled.
It costs an extra indirection and neither of the two modules using it has a
working `forRootAsync` (finding `N3`). Do not add new modules in this style.

## Writing a module CLAUDE.md

Use this skeleton. Required sections — `## Scope`, `## Public surface`,
`## Rules`, `## Tests`, `## Reuse`, `## Known gaps` — are enforced by
`scripts/check-claude-docs.mjs`.

```markdown
# <Module name> — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/<module>/`.

## Scope
## Public surface
## Internal            [optional]
## Configuration       [optional]
## Rules
## Adding an adapter   [optional — adapter modules only]
## Tests
## Reuse
## Known gaps
```

Three habits keep these files useful:

- **Write the boundary, not the tutorial.** `## Scope` must contain an explicit
  "Does not own:" line. The recipes belong in `README.md`.
- **Cite, don't restate.** Root invariants are `T1`-`T8`; defects are the IDs in
  `docs/audit/2026-09-11-template-audit.md`. Repeating their text means two
  copies to keep in sync, and the READMEs already show how that ends (`D1`-`D5`).
- **Mark deliberately-absent paths with `!`.** `scripts/check-claude-docs.mjs`
  asserts that every backticked file or directory path exists. When a doc has to
  name a path that does *not* exist — a file a stale README invented, a scope a
  project would add later — write it as `` `!src/thing.ts` ``. The validator then
  asserts the opposite, so the note also fails the day someone creates the file
  and forgets to update the doc.
