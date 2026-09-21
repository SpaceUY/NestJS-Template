# Cache Module

Provider-agnostic cache with adapter composition and optional extensions.

---

## Core Contract

The public service is [`CacheService`](./abstract/cache.service.ts):

- `get(key)` → `string | null`
- `set(key, value, ttl?)`
- `del(...keys)`
- `clear()`

Extensions add provider-specific capabilities on top without polluting the base contract.

---

## Directory Structure

```text
src/cache/
├── abstract/
│   ├── cache.tokens.ts
│   ├── cache.service.ts
│   ├── cache.interfaces.ts
│   ├── cache.error.ts
│   ├── cache-abstract.module.ts
│   ├── extensions/
│   │   ├── cache-list.extension.ts
│   │   └── cache-keys.extension.ts
│   └── mocks/
│       ├── cache.service.mock.ts
│       ├── cache-list.extension.mock.ts
│       └── cache-keys.extension.mock.ts
├── redis-adapter/
│   ├── redis-adapter-config.interface.ts
│   ├── redis-adapter.service.ts
│   ├── client.ts
│   ├── extensions/
│   │   ├── redis-cache-list.extension.ts
│   │   └── redis-cache-keys.extension.ts
│   └── utils/
│       └── logger.ts
└── README.md
```

---

## Registration

Adapters are plain classes — no adapter module required. `CacheAbstractModule.forRootAsync` receives a factory that returns a `CacheService` instance, and optional extension implementation classes to wire as NestJS-managed services.

```ts
import { CacheAbstractModule } from './abstract/cache-abstract.module';
import { RedisCacheAdapterService } from './redis-adapter/redis-adapter.service';
import { RedisCacheListExtension } from './redis-adapter/extensions/redis-cache-list.extension';
import { RedisCacheKeysExtension } from './redis-adapter/extensions/redis-cache-keys.extension';
import { redisScope, RedisScopeConfig } from '../redis.scope';

CacheAbstractModule.forRootAsync({
  isGlobal: true,
  inject: [redisScope.KEY],
  useFactory: (redis: RedisScopeConfig): RedisCacheAdapterService => {
    return new RedisCacheAdapterService({
      protocol: 'redis',
      host: redis.host,
      port: redis.port,
      password: redis.password || undefined,
    });
  },
  extensions: {
    list: RedisCacheListExtension,
    keys: RedisCacheKeysExtension,
  },
})
```

The `extensions` object maps abstract extension tokens to concrete implementation classes; NestJS manages their lifecycle and injects the raw client (via `adapter.client`) and shared logger (via `adapter.logger`) automatically.

Omit `extensions` (or individual keys) to skip those providers entirely:

```ts
CacheAbstractModule.forRootAsync({
  isGlobal: true,
  useFactory: (cfg) => new RedisCacheAdapterService(cfg),
})
```

For simple class-based (sync) registration with no extensions:

```ts
CacheAbstractModule.forRoot({
  isGlobal: true,
  adapter: MyCustomCacheService,
})
```

---

## Built-in Adapters

### `RedisCacheAdapterService`

Supports both standalone and cluster Redis (including AWS ElastiCache). Constructor takes config only — extensions are handled at the module level.

**Configuration:**

```ts
interface RedisAdapterConfig {
  protocol: 'redis' | 'rediss';
  host: string;
  port: number;
  password?: string;
  reconnectionDelayMs?: number;   // default: 5000
  reconnectionMaxRetries?: number; // default: 10
  clusterMode?: boolean;
  clusterOptions?: {
    scaleReads?: 'master' | 'slave' | 'all';
    maxRedirections?: number;
    retryDelayOnFailover?: number;
    dnsLookup?: (address, callback) => void;
    redisOptions?: RedisOptions;
  };
  logger?: StandardLogger; // defaults to NestJS Logger
}
```

**Cluster mode:**

```ts
const adapter = new RedisCacheAdapterService({
  protocol: 'rediss',
  host: cfg.host,
  port: cfg.port,
  clusterMode: true,
  clusterOptions: { scaleReads: 'slave', maxRedirections: 16 },
});
```

The adapter performs a startup connection check during `onModuleInit` and hard-stops the application (`process.exit(1)`) if Redis is unreachable within 5 seconds.

---

## Extensions

Extensions expose provider-specific operations as independently injectable NestJS services.

Why extensions and not just a bigger base service? Because most of the time, we won't be using most of the possible methods we could use from a cache provider. Arguably, we'll need only the basic services (read, write, delete) in most scenarios, and other advanced functionalities will be more niche. For this reason, these bundles of custom functionalities are cast into **extensions**, so that the developer is mindful of **what they are adding** and **why they need it**.

> More extensions could be added as needed. An extension is simply a granular unit of cohesive functionality, so feel free to open up a discussion with the team in order to modify existing extensions, or add new ones.

In order to add an extension to the cache module, pass the implementation class to `forRootAsync` to enable it; the abstract module wires `CACHE_ADAPTER_CLIENT` and `CACHE_LOGGER` and creates the service via `useClass`.

### `CacheListExtension`

Redis list operations. Enable with `extensions: { list: RedisCacheListExtension }`.

```ts
abstract class CacheListExtension {
  lpush(key: string, value: string | string[]): Promise<number>;
  rpush(key: string, value: string | string[]): Promise<number>;
  lpop(key: string): Promise<string | null>;
  rpop(key: string): Promise<string | null>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  llen(key: string): Promise<number>;
  lrem(key: string, count: number, value: string): Promise<number>;
}
```

### `CacheKeysExtension`

Pattern-based key scanning. Enable with `extensions: { keys: RedisCacheKeysExtension }`.

```ts
abstract class CacheKeysExtension {
  keys(pattern: string): Promise<string[]>;
}
```

> **Note:** Avoid `keys(*)` on large keyspaces in production — prefer `SCAN`-based approaches. This extension is suitable for low-volume or development use.

---

## Error Handling

All cache operations throw `CacheError` on failure, wrapping the underlying provider error so callers never depend on ioredis internals.

```ts
import { CacheError, CACHE_ERRORS } from 'src/cache/abstract/cache.error';

try {
  await this.cache.set('key', value);
} catch (error) {
  if (error instanceof CacheError) {
    // error.code — one of the CACHE_ERRORS string constants
    // error.message — human-readable description
    // error.data — operation context (key, keys, pattern, etc.)
  }
}
```

Error codes follow the pattern `CACHE_<OPERATION>_FAILED`. Available codes:

| Code | Operation |
|------|-----------|
| `CACHE_GET_FAILED` | `get` |
| `CACHE_SET_FAILED` | `set` |
| `CACHE_DEL_FAILED` | `del` |
| `CACHE_CLEAR_FAILED` | `clear` |
| `CACHE_LPUSH_FAILED` | `lpush` |
| `CACHE_RPUSH_FAILED` | `rpush` |
| `CACHE_LPOP_FAILED` | `lpop` |
| `CACHE_RPOP_FAILED` | `rpop` |
| `CACHE_LRANGE_FAILED` | `lrange` |
| `CACHE_LLEN_FAILED` | `llen` |
| `CACHE_LREM_FAILED` | `lrem` |
| `CACHE_KEYS_FAILED` | `keys` |

Startup connection failures are not thrown — the adapter calls `process.exit(1)` directly.

---

## Injection Patterns

**Base cache (adapter-agnostic):**

```ts
constructor(private readonly cache: CacheService) {}

await this.cache.set('user:1', JSON.stringify(user), 3600);
const raw = await this.cache.get('user:1');
const user = raw ? JSON.parse(raw) : null;
```

**List extension:**

```ts
constructor(
  @Inject(CacheListExtension) private readonly listCache: CacheListExtension,
) {}

await this.listCache.rpush('queue:jobs', jobId);
const next = await this.listCache.lpop('queue:jobs');
```

**Optional extension (graceful degradation):**

```ts
constructor(
  @Optional()
  @Inject(CacheKeysExtension)
  private readonly keysCache?: CacheKeysExtension,
) {}
```

**Raw client (advanced):**

```ts
import { CACHE_ADAPTER_CLIENT } from 'src/cache/abstract/cache.tokens';

constructor(
  @Inject(CACHE_ADAPTER_CLIENT) private readonly redis: Redis | Cluster,
) {}
```

---

## Testing

Replace real providers with mocks in unit tests:

```ts
import { MockCacheService } from 'src/cache/abstract/mocks/cache.service.mock';
import { MockCacheListExtension } from 'src/cache/abstract/mocks/cache-list.extension.mock';
import { MockCacheKeysExtension } from 'src/cache/abstract/mocks/cache-keys.extension.mock';

providers: [
  { provide: CacheService, useClass: MockCacheService },
  { provide: CacheListExtension, useClass: MockCacheListExtension },
  { provide: CacheKeysExtension, useClass: MockCacheKeysExtension },
]
```

All mock methods are `jest.fn()` with sensible defaults (`null` for gets, `0` for counts, `[]` for lists).

## Reuse

**Two supported workflows.** Clone the template whole, or lift only the modules
you need — this one is written for both. What follows is the second case: what
`src/cache/` needs in order to compile in another project.

**What travels with it.** Nothing — this is the one adapter module that imports
from no other module of the template. `pnpm run modularity:check -- --report`
prints no outgoing edge for `cache`, and that is deliberate: it is the reference
implementation of `docs/architecture/module-contract.md`.

The one thing to know is config. `src/app.module.ts` feeds the adapter from
`src/redis.scope.ts`, an application-level scope shared with
`src/queues/bullmq-adapter/`. That file is not part of this module — bring it,
or hand `RedisCacheAdapterService` its config from wherever your project keeps
it. The adapter takes a plain config object in its constructor, so it does not
care which.

**Peer dependencies.**

```bash
pnpm add ioredis        # redis-adapter/ only
```

`abstract/` needs only `@nestjs/common`.

**Removing it from the template instead.** Nothing imports `src/cache/`; it
comes out in three edits, and `src/redis.scope.ts` goes only once
`src/queues/` has gone too.
