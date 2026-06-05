import { Injectable, Logger } from '@nestjs/common';
import { Cluster, Redis } from 'ioredis';

import { CacheService } from '../abstract/cache.service';
import {
  ClusterRedisAdapterConfig,
  RedisAdapterConfig,
} from './redis-adapter-config.interface';
import { StandardLogger, adaptLogger } from './utils/logger';

@Injectable()
export class RedisCacheAdapterService extends CacheService {
  private readonly _redis: Redis | Cluster;
  private readonly _logger: StandardLogger;

  constructor(config: RedisAdapterConfig) {
    super();
    const nestLogger = new Logger(RedisCacheAdapterService.name);
    this._logger = config.logger ?? adaptLogger(nestLogger);
    this._redis = RedisCacheAdapterService._createClient(config);
    this._verifyConnection();
  }

  get client(): Redis | Cluster {
    return this._redis;
  }

  async get(key: string): Promise<string | null> {
    return this._redis.get(key);
  }

  async set(key: string, value: string | number, ttl?: number): Promise<void> {
    if (ttl !== undefined) {
      await this._redis.set(key, value, 'EX', ttl);
    } else {
      await this._redis.set(key, value);
    }
  }

  async del(...keys: string[]): Promise<void> {
    await this._redis.del(...keys);
  }

  async clear(): Promise<void> {
    await this._redis.flushall();
  }

  private static _createClient(config: RedisAdapterConfig): Redis | Cluster {
    const {
      clusterMode = false,
      protocol,
      password,
      host,
      port,
      reconnectionDelayMs = 5000,
      reconnectionMaxRetries = 10,
    } = config;

    const retryStrategy = (times: number) => {
      if (times < reconnectionMaxRetries) return reconnectionDelayMs;
      return null;
    };

    if (clusterMode) {
      const { clusterOptions = {} } = config as ClusterRedisAdapterConfig;
      return new Cluster([{ host, port }], {
        dnsLookup:
          clusterOptions.dnsLookup ||
          ((address, callback) => callback(null, address)),
        scaleReads: clusterOptions.scaleReads || 'master',
        maxRedirections: clusterOptions.maxRedirections || 16,
        redisOptions: clusterOptions.redisOptions,
      });
    }

    const redisUrl = `${protocol}://:${password}@${host}:${port}`;
    return new Redis(redisUrl, { retryStrategy });
  }

  private async _verifyConnection(): Promise<void> {
    const TIMEOUT_MS = 5000;
    const testKey = `redis-startup-test-${Date.now()}`;
    const testValue = 'connection-test';

    try {
      await Promise.race([
        this._testRedisOperations(testKey, testValue),
        this._createTimeoutPromise(TIMEOUT_MS),
      ]);
    } catch (error) {
      this._logger.error({
        message: '❌ Redis connection failed:',
        data: { error: error.message },
      });
      this._logger.error({
        message: '🚨 STOPPING APPLICATION - Redis is required for operation',
      });
      process.exit(1);
    }
  }

  private async _testRedisOperations(
    testKey: string,
    testValue: string,
  ): Promise<void> {
    const startTime = Date.now();
    await this._redis.set(testKey, testValue);
    const retrievedValue = await this._redis.get(testKey);
    if (retrievedValue !== testValue) {
      throw new Error(
        `Redis read/write test failed. Expected: ${testValue}, Got: ${retrievedValue}`,
      );
    }
    await this._redis.del(testKey);
    const responseTime = Date.now() - startTime;
    console.log(`✅ Redis operations completed in ${responseTime}ms`);
  }

  private _createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Redis connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }
}
