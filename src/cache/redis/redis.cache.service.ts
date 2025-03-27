import type { RedisClient } from './redis.cache.module';

import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from './redis.cache.module';

@Injectable()
export class CacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly _redis: RedisClient) {}

  /**
   * Gets the Redis client.
   * @returns {RedisClient} The Redis client.
   */
  get client(): RedisClient {
    return this._redis;
  }

  /**
   * Gets the value at the specified key.
   * @param {string} key - The key to get the value from.
   * @returns {Promise<string | null>} The result of the get operation.
   */
  async get(key: string): Promise<string | null> {
    return this._redis.get(key);
  }

  /**
   * Sets the value at the specified key.
   * @param {string} key - The key to set the value at.
   * @param {string | number} value - The value to set at the specified key.
   * @returns {Promise<void>} The result of the set operation.
   */
  async set(key: string, value: string | number): Promise<void> {
    await this._redis.set(key, value);
  }
}
