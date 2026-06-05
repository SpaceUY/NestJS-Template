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
│   ├── redis-adapter.module.ts
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

`CacheAbstractModule.forRoot` accepts an adapter module and an optional list of extension tokens to re-export.

```ts
CacheAbstractModule.forRoot({
  adapter: RedisAdapterModule.registerAsync({ ... }),
  isGlobal: true,
  extensions: [CacheListExtension, CacheKeysExtension],
})
```

The adapter module is responsible for providing `CACHE_PROVIDER` (the bridge token) and any extension tokens it supports. The abstract module imports it, aliases `CACHE_PROVIDER` to `CacheService`, and re-exports whichever extension tokens you declare.

---

## Built-in Adapters

### `RedisAdapterModule`

Supports both standalone and cluster Redis (including AWS ElastiCache).

**Sync registration:**

```ts
import { CacheAbstractModule } from './abstract/cache-abstract.module';
import { RedisAdapterModule } from './redis-adapter/redis-adapter.module';

CacheAbstractModule.forRoot({
  isGlobal: true,
  adapter: RedisAdapterModule.register({
    config: {
      protocol: 'redis',
      host: 'localhost',
      port: 6379,
      password: 'secret',
    },
  }),
})
```

**Async registration (recommended for production):**

```ts
import type { ConfigType } from '@nestjs/config';
import { CacheAbstractModule } from './abstract/cache-abstract.module';
import { RedisAdapterModule } from './redis-adapter/redis-adapter.module';
import { CacheListExtension } from './abstract/extensions/cache-list.extension';
import { CacheKeysExtension } from './abstract/extensions/cache-keys.extension';
import { redisConfig } from '@/config/redis.config';

CacheAbstractModule.forRoot({
  isGlobal: true,
  adapter: RedisAdapterModule.registerAsync({
    inject: [redisConfig.KEY],
    imports: [ConfigModule],
    useFactory: (cfg: ConfigType<typeof redisConfig>) => ({
      protocol: cfg.protocol,
      host: cfg.host,
      port: cfg.port,
      password: cfg.password,
    }),
    extensions: { list: true, keys: true },
  }),
  extensions: [CacheListExtension, CacheKeysExtension],
})
```

**Cluster mode:**

```ts
RedisAdapterModule.registerAsync({
  useFactory: (cfg) => ({
    protocol: 'rediss',
    host: cfg.host,
    port: cfg.port,
    clusterMode: true,
    clusterOptions: {
      scaleReads: 'slave',
      maxRedirections: 16,
    },
  }),
  // ...
})
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

The adapter performs a startup connection check and hard-stops the application (`process.exit(1)`) if Redis is unreachable within 5 seconds.

---

## Extensions

Extensions expose provider-specific operations as independently injectable services. Consumers inject only what they need; adapters opt in to what they support.

### `CacheListExtension`

Redis list operations. Enable with `extensions: { list: true }` in `RedisAdapterModule`.

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

Pattern-based key scanning. Enable with `extensions: { keys: true }` in `RedisAdapterModule`.

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

**Raw client (advanced use cases):**

```ts
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

// In your testing module:
providers: [
  { provide: CacheService, useClass: MockCacheService },
  { provide: CacheListExtension, useClass: MockCacheListExtension },
  { provide: CacheKeysExtension, useClass: MockCacheKeysExtension },
]
```

All mock methods are `jest.fn()` with sensible defaults (`null` for gets, `0` for counts, `[]` for lists).
