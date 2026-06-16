import { Inject, Injectable } from '@nestjs/common';
import { Cluster, Redis } from 'ioredis';

import { CacheError, CACHE_ERRORS } from '../../abstract/cache.error';
import { CacheListExtension } from '../../abstract/extensions/cache-list.extension';
import {
  CACHE_ADAPTER_CLIENT,
  CACHE_LOGGER,
} from '../../abstract/cache.tokens';
import { StandardLogger } from '../utils/logger';

@Injectable()
export class RedisCacheListExtension extends CacheListExtension {
  constructor(
    @Inject(CACHE_ADAPTER_CLIENT) private readonly _redis: Redis | Cluster,
    @Inject(CACHE_LOGGER) private readonly _logger: StandardLogger,
  ) {
    super();
  }

  async lpush(key: string, value: string | string[]): Promise<number> {
    this._logger.debug({
      message: 'Pushing value(s) to the left of cache list',
      data: { key },
    });
    try {
      if (Array.isArray(value)) {
        return await this._redis.lpush(key, ...value);
      }
      return await this._redis.lpush(key, value);
    } catch {
      throw new CacheError(CACHE_ERRORS.LPUSH_FAILED, 'Cache lpush failed', {
        key,
      });
    }
  }

  async rpush(key: string, value: string | string[]): Promise<number> {
    this._logger.debug({
      message: 'Pushing value(s) to the right of cache list',
      data: { key },
    });
    try {
      if (Array.isArray(value)) {
        return await this._redis.rpush(key, ...value);
      }
      return await this._redis.rpush(key, value);
    } catch {
      throw new CacheError(CACHE_ERRORS.RPUSH_FAILED, 'Cache rpush failed', {
        key,
      });
    }
  }

  async lpop(key: string): Promise<string | null> {
    this._logger.debug({
      message: 'Popping value from the left of cache list',
      data: { key },
    });
    try {
      return await this._redis.lpop(key);
    } catch {
      throw new CacheError(CACHE_ERRORS.LPOP_FAILED, 'Cache lpop failed', {
        key,
      });
    }
  }

  async rpop(key: string): Promise<string | null> {
    this._logger.debug({
      message: 'Popping value from the right of cache list',
      data: { key },
    });
    try {
      return await this._redis.rpop(key);
    } catch {
      throw new CacheError(CACHE_ERRORS.RPOP_FAILED, 'Cache rpop failed', {
        key,
      });
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    this._logger.debug({
      message: 'Getting range of elements from cache list',
      data: { key, start, stop },
    });
    try {
      return await this._redis.lrange(key, start, stop);
    } catch {
      throw new CacheError(CACHE_ERRORS.LRANGE_FAILED, 'Cache lrange failed', {
        key,
        start,
        stop,
      });
    }
  }

  async llen(key: string): Promise<number> {
    this._logger.debug({
      message: 'Getting length of cache list',
      data: { key },
    });
    try {
      return await this._redis.llen(key);
    } catch {
      throw new CacheError(CACHE_ERRORS.LLEN_FAILED, 'Cache llen failed', {
        key,
      });
    }
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    this._logger.debug({
      message: 'Removing elements from cache list',
      data: { key, count },
    });
    try {
      return await this._redis.lrem(key, count, value);
    } catch {
      throw new CacheError(CACHE_ERRORS.LREM_FAILED, 'Cache lrem failed', {
        key,
        count,
      });
    }
  }
}
