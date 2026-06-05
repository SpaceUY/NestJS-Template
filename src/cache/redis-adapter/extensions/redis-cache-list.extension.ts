import { Inject, Injectable } from '@nestjs/common';
import { Cluster, Redis } from 'ioredis';

import { CacheListExtension } from '../../abstract/extensions/cache-list.extension';
import { CACHE_ADAPTER_CLIENT } from '../../abstract/cache.tokens';

@Injectable()
export class RedisCacheListExtension extends CacheListExtension {
  constructor(
    @Inject(CACHE_ADAPTER_CLIENT) private readonly _redis: Redis | Cluster,
  ) {
    super();
  }

  async lpush(key: string, value: string | string[]): Promise<number> {
    if (Array.isArray(value)) {
      return this._redis.lpush(key, ...value);
    }
    return this._redis.lpush(key, value);
  }

  async rpush(key: string, value: string | string[]): Promise<number> {
    if (Array.isArray(value)) {
      return this._redis.rpush(key, ...value);
    }
    return this._redis.rpush(key, value);
  }

  async lpop(key: string): Promise<string | null> {
    return this._redis.lpop(key);
  }

  async rpop(key: string): Promise<string | null> {
    return this._redis.rpop(key);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this._redis.lrange(key, start, stop);
  }

  async llen(key: string): Promise<number> {
    return this._redis.llen(key);
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    return this._redis.lrem(key, count, value);
  }
}
