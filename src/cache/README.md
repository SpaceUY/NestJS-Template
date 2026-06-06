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

CacheAbstractModule.forRootAsync({
  isGlobal: true,
  inject: [redisConfig.KEY],
  imports: [ConfigModule],
  useFactory: (cfg: ConfigType<typeof redisConfig>): RedisCacheAdapterService => {
    return new RedisCacheAdapterService(cfg);
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

Extensions expose provider-specific operations as independently injectable NestJS services. Pass the implementation class to `forRootAsync` to enable it; the abstract module wires `CACHE_ADAPTER_CLIENT` and `CACHE_LOGGER` and creates the service via `useClass`.

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
