# Cache — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded). Read it first — this file
> adds only what is specific to `src/cache/`.

This module is the reference implementation of the template's adapter shape:
`abstract/` holds the contract, the dynamic module, the error type and the
tokens; each `<provider>-adapter/` directory holds one implementation; every
provider error is translated into the module's own; and it is the one module
that ships test doubles for its consumers.

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

The adapter, both extensions, the client factory and the logger adapter each
have a spec; `ioredis` is mocked at module level in
`src/cache/redis-adapter/client.unit.spec.ts` so nothing opens a socket. The
doubles are for consumers:

```ts
providers: [
  { provide: CacheService, useClass: MockCacheService },
  { provide: CacheListExtension, useClass: MockCacheListExtension },
]
```

Every mock method is a `jest.fn()` with a sane default (`null` for gets, `0` for
counts, `[]` for lists). Adapter tests construct the adapter with `new` and mock
`ioredis` at module level.

What the adapter specs pin down beyond the happy path: every driver failure
becomes a `CacheError` carrying its own code and never the ioredis message, no
cached *value* reaches the debug log, and `verifyConnection` stops the process
rather than booting with a cache that answers wrong.

## Reuse

Copy `src/cache/abstract/` plus the adapter directories you want. No edge
leaves this module — `pnpm run modularity:check -- --report` prints none for
`cache`, which is what makes it the one adapter module that lifts with zero
companion directories. `abstract/` depends only on `@nestjs/common`;
`redis-adapter/` needs `ioredis`.

Config is the one thing to carry over deliberately: `src/app.module.ts` feeds
the adapter from `src/redis.scope.ts`, an application-level scope shared with
`src/queues/bullmq-adapter/`, and that file is not part of this module. Bring
it, or hand `RedisCacheAdapterService` a config object from wherever the target
project keeps its own — the constructor takes a plain object and does not
care.

`src/cache/README.md`'s `## Reuse` is the human version of this section. Keep
the two congruent (`T7`).

## Known gaps

**The config scope is not part of this module.** `src/redis.scope.ts` lives at
application level because one Redis instance backs both this module and
`src/queues/bullmq-adapter/`, and neither owns it — the same way
`src/app.scope.ts` is application-level rather than any module's. It is a
deliberate, narrow exception to "a scope lives next to the module that consumes
it" (`src/config-provider/CLAUDE.md`), and it costs this module its otherwise
complete self-containment: lifting `src/cache/` means also taking that scope, or
writing a cache-local one. `## Reuse` above has the third option — hand the
adapter a plain config object instead.

**`keys('*')` is available and dangerous.** `CacheKeysExtension` scans the
keyspace; against a production Redis that is a blocking operation. Rule 7.
