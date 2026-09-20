# Cache — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/cache/`.

This module is the reference implementation of the contract: style-A
registration, error translation, and the only module that ships mocks.

## Scope

Owns a provider-agnostic key/value cache and the extension mechanism that
exposes provider-specific operations without bloating the base contract.

Does not own: HTTP response caching, memoization, or the choice of what to cache
— the consuming service decides that.

Registered in `src/app.module.ts` via `CacheAbstractModule.forRootAsync`, bound
to `RedisCacheAdapterService`.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `CacheService` | `src/cache/abstract/cache.service.ts` | The contract: `get`, `set`, `del`, `clear` — inject this |
| `CacheAbstractModule` | `src/cache/abstract/cache-abstract.module.ts` | `forRoot` / `forRootAsync` |
| `CacheListExtension` | `src/cache/abstract/extensions/cache-list.extension.ts` | List operations |
| `CacheKeysExtension` | `src/cache/abstract/extensions/cache-keys.extension.ts` | Pattern key scan |
| `CacheError`, `CACHE_ERRORS` | `src/cache/abstract/cache.error.ts` | Error type and codes |
| `CACHE_ADAPTER_CLIENT`, `CACHE_LOGGER` | `src/cache/abstract/cache.tokens.ts` | Raw client / logger — advanced use only |
| `MockCacheService` and siblings | `src/cache/abstract/mocks/` | Test doubles |
| `RedisCacheAdapterService` | `src/cache/redis-adapter/redis-adapter.service.ts` | Named only in `src/app.module.ts` |
| `redisScope`, `RedisScopeConfig` | `src/redis.scope.ts` | `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` config scope, shared with `src/queues/bullmq-adapter/`, injected into the `forRootAsync` factory |

## Rules

1. Inject `CacheService`. The base contract stores strings — serialize with
   `JSON.stringify` on write and parse on read; that is the consumer's job, not
   the cache's.
2. An **extension** is a cohesive bundle of provider-specific operations, opt-in
   at registration. It exists so a project pulls in only what it uses and so the
   developer is deliberate about the dependency. Do not widen `CacheService`
   with provider-specific methods — add or extend an extension instead, and
   discuss it with the team first.
3. Enable extensions by passing implementation classes:
   `extensions: { list: RedisCacheListExtension, keys: RedisCacheKeysExtension }`.
   The abstract module wires `CACHE_ADAPTER_CLIENT` and `CACHE_LOGGER` and binds
   each by `useClass`. Omit the key and the provider is never created.
4. Inject an extension by its abstract class:
   `@Inject(CacheListExtension) private readonly lists: CacheListExtension`. Add
   `@Optional()` when the feature should degrade rather than fail if the
   extension was not enabled.
5. Every operation throws `CacheError` with a `CACHE_<OPERATION>_FAILED` code and
   operation context in `data`. Callers never see an `ioredis` error.
6. Startup is fail-fast, not fail-soft: the Redis adapter checks the connection
   in `onModuleInit` and calls `process.exit(1)` if the server is unreachable
   within five seconds. That is deliberate — a silently cache-less service is
   worse than one that will not boot. It is also why startup failures are not
   thrown as `CacheError`.
7. Avoid `keys('*')` against a production keyspace. The extension documents this
   and it holds.
8. `CACHE_ADAPTER_CLIENT` hands out the raw `ioredis` client. Injecting it
   couples your code to Redis — justify it or add an extension instead.

## Adding an adapter

1. Create `src/cache/<provider>-adapter/<provider>-adapter.service.ts` extending
   `CacheService`, implementing `get`, `set`, `del`, `clear` and exposing
   `client` and `logger`.
2. Add `<provider>-adapter-config.interface.ts` for the constructor options.
3. Wrap every provider call and rethrow `CacheError` with the matching
   `CACHE_ERRORS` code.
4. Implement the extensions the provider supports under
   `<provider>-adapter/extensions/`, each extending the abstract extension class.
5. Register through `CacheAbstractModule.forRootAsync` in `src/app.module.ts`.
6. Add `*.unit.spec.ts` for the adapter and each extension.

## Tests

No adapter test exists yet (finding `G1`), but the doubles do — consumers use
them:

```ts
providers: [
  { provide: CacheService, useClass: MockCacheService },
  { provide: CacheListExtension, useClass: MockCacheListExtension },
]
```

Every mock method is a `jest.fn()` with a sane default (`null` for gets, `0` for
counts, `[]` for lists). Adapter tests construct the adapter with `new` and mock
`ioredis` at module level.

## Reuse

Copy `src/cache/abstract/` plus the adapter directories you want. `abstract/`
depends only on `@nestjs/common`; `redis-adapter/` needs `ioredis` plus
`src/redis.scope.ts` (shared with `src/queues/bullmq-adapter/` — bring it
along, or replace it with a cache-local scope if lifting `redis-adapter/`
without `queues/`).

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`D4`** — ~~`src/cache/README.md` still shows `@nestjs/config` `ConfigType`
  registration; the project uses config-provider scopes and `@nestjs/config` is
  not a dependency.~~ **Fixed:** the README's `forRootAsync` example now injects
  `redisScope` via `@Inject(redisScope.KEY)` and types the factory parameter as
  `RedisScopeConfig`, matching `src/app.module.ts`.
- **`G1`** — no adapter or extension tests.
- **`L2`** — ~~`src/cache/redis-adapter/utils/logger.ts:25` disables a rule named
  `ts/no-explicit-any`, which does not exist; ESLint errors on the bogus name and
  flags the `any` anyway. The prefix should be `@typescript-eslint/`.~~ **Fixed:
  the prefix was corrected to `@typescript-eslint/`.**
- ~~`!src/cache/redis-adapter/config/redis-cache.scope.ts` and
  `!src/queues/bullmq-adapter/config/bullmq-redis.scope.ts` were near-duplicate
  Joi schemas pointed at the same Redis instance, added independently for
  cache and BullMQ.~~ **Fixed:** consolidated into the shared `redisScope`
  (`src/redis.scope.ts`) both `CacheAbstractModule` and `BullmqAdapterModule`
  now inject. This is a deliberate, narrow exception to "a scope lives next
  to the module that consumes it" (`src/config-provider/CLAUDE.md`): Redis is
  genuinely shared infrastructure here, not owned by either module, the same
  way `src/app.scope.ts` is application-level rather than owned by one
  module. The tradeoff: `src/cache/` is no longer fully self-contained for
  reuse — copying it elsewhere now also means copying `src/redis.scope.ts` (or
  reintroducing a cache-local scope).
