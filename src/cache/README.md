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
│   ├── extensions/
│   │   ├── redis-cache-list.extension.ts
│   │   └── redis-cache-keys.extension.ts
│   └── utils/
│       └── logger.ts
└── README.md
```

---

## Registration

Adapters are plain classes — no adapter module required. `CacheAbstractModule.forRootAsync` receives a factory that returns a `CacheAdapterBundle` (service + raw client), and extension implementation classes to wire as NestJS-managed services.

```ts
import { CacheAbstractModule, CacheAdapterBundle } from './abstract/cache-abstract.module';
import { RedisCacheAdapterService } from './redis-adapter/redis-adapter.service';
import { RedisCacheListExtension } from './redis-adapter/extensions/redis-cache-list.extension';
import { RedisCacheKeysExtension } from './redis-adapter/extensions/redis-cache-keys.extension';
import { Redis } from 'ioredis';

CacheAbstractModule.forRootAsync<Redis>({
  isGlobal: true,
  inject: [redisConfig.KEY],
  imports: [ConfigModule],
  useFactory: (cfg: ConfigType<typeof redisConfig>): CacheAdapterBundle<Redis> => {
    const adapter = new RedisCacheAdapterService(cfg);
    return { service: adapter, client: adapter.client as Redis };
  },
  extensions: {
    list: RedisCacheListExtension,
    keys: RedisCacheKeysExtension,
  },
})
```

The generic type parameter (`<Redis>`) is optional — TypeScript infers it from the factory return. The `extensions` object maps abstract extension tokens to concrete implementation classes; NestJS manages their lifecycle and injects the client automatically.

Omit `extensions` (or individual keys) to skip those providers entirely:

```ts
CacheAbstractModule.forRootAsync({
  isGlobal: true,
  useFactory: (cfg) => {
    const adapter = new RedisCacheAdapterService(cfg);
    return { service: adapter, client: adapter.client };
  },
  // no extensions — only CacheService is provided
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

```ts
const adapter = new RedisCacheAdapterService(config);
// adapter.client exposes the underlying Redis | Cluster instance for the bundle
```

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

The adapter performs a startup connection check and hard-stops the application (`process.exit(1)`) if Redis is unreachable within 5 seconds.

---

## Extensions

Extensions expose provider-specific operations as independently injectable NestJS services. Pass the implementation class to `forRootAsync` to enable it; the abstract module wires `CACHE_ADAPTER_CLIENT` and creates the service via `useClass`.

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
