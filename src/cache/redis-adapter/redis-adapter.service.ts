import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cluster, Redis } from 'ioredis';

import { CACHE_ERRORS, CacheError } from '../abstract/cache.error';
import { CacheService } from '../abstract/cache.service';
import { createRedisClient, verifyConnection } from './client';
import { RedisAdapterConfig } from './redis-adapter-config.interface';
import { StandardLogger, adaptLogger } from './utils/logger';

@Injectable()
export class RedisCacheAdapterService extends CacheService implements OnModuleInit {
  private readonly _redis: Redis | Cluster;
  private readonly _logger: StandardLogger;

  constructor(config: RedisAdapterConfig) {
    super();
    const nestLogger = new Logger(RedisCacheAdapterService.name);
    this._logger = config.logger ?? adaptLogger(nestLogger);
    this._redis = createRedisClient(config);
  }

  async onModuleInit(): Promise<void> {
    await verifyConnection(this._redis, this._logger);
  }

  get client(): Redis | Cluster {
    return this._redis;
  }

  get logger(): StandardLogger {
    return this._logger;
  }

  async get(key: string): Promise<string | null> {
    this._logger.debug({ message: 'Getting value from cache', data: { key } });
    try {
      return await this._redis.get(key);
    } catch {
      throw new CacheError(CACHE_ERRORS.GET_FAILED, 'Cache get failed', { key });
    }
  }

  async set(key: string, value: string | number, ttl?: number): Promise<void> {
    this._logger.debug({ message: 'Setting value to cache', data: { key, ttl } });
    try {
      if (ttl !== undefined) {
        await this._redis.set(key, value, 'EX', ttl);
      } else {
        await this._redis.set(key, value);
      }
    } catch {
      throw new CacheError(CACHE_ERRORS.SET_FAILED, 'Cache set failed', { key });
    }
  }

  async del(...keys: string[]): Promise<void> {
    this._logger.debug({ message: 'Deleting keys from cache', data: { keys } });
    try {
      await this._redis.del(...keys);
    } catch {
      throw new CacheError(CACHE_ERRORS.DEL_FAILED, 'Cache deletion failed', { keys });
    }
  }

  async clear(): Promise<void> {
    this._logger.debug({ message: 'Clearing cache' });
    try {
      await this._redis.flushall();
    } catch {
      throw new CacheError(CACHE_ERRORS.CLEAR_FAILED, 'Cache clear failed');
    }
  }

}
