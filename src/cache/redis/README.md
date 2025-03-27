# Redis Cache Module

A NestJS module that provides Redis caching functionality with a clean, injectable service interface.

## Overview

This module provides a Redis-based caching solution for NestJS applications. It includes:

- A configurable Redis cache module
- A service wrapper for Redis operations
- Mock implementations for testing

## Directory Structure

```
redis/
├── README.md
├── cache.module.ts # Redis cache module configuration
├── cache.service.ts # Redis cache service implementation
└── mocks/ # Mock implementations for testing
```

## Features

- Configurable Redis connection
- Type-safe cache operations
- Easy-to-use service interface
- Testing utilities and mocks
- Integration with NestJS dependency injection

## Installation

Ensure you have the required dependencies:

```bash
npm install ioredis
```

## Usage

### 1. Import the Module

```typescript
import { Module } from '@nestjs/common';
import { RedisCacheModule } from './cache/redis/cache.module';

@Module({
  imports: [
    RedisCacheModule.forRoot({
      host: 'localhost',
      port: 6379,
      // other Redis options...
    }),
  ],
})
export class AppModule {}
```

### 2. Use the Cache Service

```typescript
import { Injectable } from '@nestjs/common';
import { RedisCacheService } from './cache/redis/cache.service';

@Injectable()
export class YourService {
  constructor(private readonly cacheService: RedisCacheService) {}

  async getData(key: string): Promise<any> {
    // Try to get from cache first
    const cached = await this.cacheService.get(key);
    if (cached) return cached;

    // If not in cache, get data and cache it
    const data = await this.fetchData();
    await this.cacheService.set(key, data);
    return data;
  }
}
```

## Configuration Options

The `RedisCacheModule.forRoot()` method accepts standard Redis configuration options:

```typescript
interface RedisCacheModuleOptions {
  protocol: 'redis' | 'rediss';
  password?: string;
  host: string;
  port: number;
  clusterMode?: boolean;
  reconnectionDelayMs?: number;
  reconnectionMaxRetries?: number;
}
```

There's also a `forRootAsync` option which allows for dependency injection. For instance, the module can be used in the following fashion:

```typescript
RedisCacheModule.forRootAsync({
  useFactory: (config: ConfigType<typeof redisConfig>) => config,
  inject: [redisConfig.KEY],
}),
```

Assuming that a `redisConfig` is registered using `@nestjs/common`'s `registerAs` method.

## API Reference

### RedisCacheService

The main service for interacting with Redis cache:

```typescript
class RedisCacheService {
  // Store a value in cache
  async set(key: string, value: any, ttl?: number): Promise<void>;

  // Retrieve a value from cache
  async get<T>(key: string): Promise<T | null>;
}
```

## Testing

The module includes mock implementations for testing:

```typescript
import { RedisCacheMockService } from './cache/redis/mocks/cache.mock.service';

describe('YourService', () => {
  let service: YourService;
  let cacheService: RedisCacheMockService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        YourService,
        {
          provide: RedisCacheService,
          useClass: RedisCacheMockService,
        },
      ],
    }).compile();

    service = module.get(YourService);
    cacheService = module.get(RedisCacheService);
  });

  // Your tests...
});
```

## Best Practices

1. **Key Management**

   - Use consistent key naming conventions
   - Consider using key prefixes to avoid collisions
   - Document key patterns used in your application

2. **Error Handling**

   - Always handle potential Redis connection errors
   - Implement fallback mechanisms for cache failures
   - Use try-catch blocks around cache operations

3. **Performance**
   - Set appropriate TTL values for cached data
   - Monitor cache hit/miss ratios
   - Consider implementing cache warming strategies

## Contributing

Feel free to submit issues and enhancement requests!
