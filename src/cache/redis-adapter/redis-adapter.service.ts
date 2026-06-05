import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cluster, Redis } from 'ioredis';

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

  async get(key: string): Promise<string | null> {
    this._logger.debug({ message: 'Cache get', data: { key } });
    return this._redis.get(key);
  }

  async set(key: string, value: string | number, ttl?: number): Promise<void> {
    this._logger.debug({ message: 'Cache set', data: { key, ttl } });
    if (ttl !== undefined) {
      await this._redis.set(key, value, 'EX', ttl);
    } else {
      await this._redis.set(key, value);
    }
  }

  async del(...keys: string[]): Promise<void> {
    this._logger.debug({ message: 'Cache del', data: { keys } });
    await this._redis.del(...keys);
  }

  async clear(): Promise<void> {
    this._logger.debug({ message: 'Cache clear' });
    await this._redis.flushall();
  }

}
