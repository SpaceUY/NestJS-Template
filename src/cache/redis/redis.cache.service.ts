import type { RedisClient } from './redis.cache.module';

import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT, REDIS_LOGGER_TOKEN } from './redis.cache.module';
import { StandardLogger } from './utils/logger';

@Injectable()
export class CacheService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly _redis: RedisClient,
    @Inject(REDIS_LOGGER_TOKEN) private readonly _logger: StandardLogger,
  ) {
    // Verify Redis connection immediately on startup
    this._verifyConnection();
  }

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
   * @returns {Promise<string | number | null>} The result of the get operation.
   */
  async get(key: string): Promise<string | number | null> {
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

  /**
   * Removes the value at the specified key.
   * @param {string} key - The key to remove the value from.
   * @returns {Promise<void>} The result of the remove operation.
   */
  async remove(key: string): Promise<void> {
    await this._redis.del(key);
  }

  /**
   * Removes all values from the Redis cache.
   * @returns {Promise<void>} The result of the clear operation.
   */
  async clear(): Promise<void> {
    await this._redis.flushall();
  }

  /**
   * Returns all keys that match the pattern.
   * @param {string} pattern - The pattern to match.
   * @returns {Promise<string[]>} The result of the keys operation.
   */
  async keys(pattern: string): Promise<string[]> {
    return this._redis.keys(pattern);
  }

  /**
   * Prepends one or more values to a list.
   * @param {string} key - The key of the list.
   * @param {string | string[]} value - The value(s) to prepend.
   * @returns {Promise<number>} The length of the list after the push operation.
   */
  async lpush(key: string, value: string | string[]): Promise<number> {
    if (Array.isArray(value)) {
      return this._redis.lpush(key, ...value);
    }
    return this._redis.lpush(key, value);
  }

  /**
   * Appends one or more values to a list.
   * @param {string} key - The key of the list.
   * @param {string | string[]} value - The value(s) to append.
   * @returns {Promise<number>} The length of the list after the push operation.
   */
  async rpush(key: string, value: string | string[]): Promise<number> {
    if (Array.isArray(value)) {
      return this._redis.rpush(key, ...value);
    }
    return this._redis.rpush(key, value);
  }

  /**
   * Removes and returns the first element of a list.
   * @param {string} key - The key of the list.
   * @returns {Promise<string | null>} The popped element.
   */
  async lpop(key: string): Promise<string | null> {
    return this._redis.lpop(key);
  }

  /**
   * Removes and returns the last element of a list.
   * @param {string} key - The key of the list.
   * @returns {Promise<string | null>} The popped element.
   */
  async rpop(key: string): Promise<string | null> {
    return this._redis.rpop(key);
  }

  /**
   * Returns a range of elements from a list.
   * @param {string} key - The key of the list.
   * @param {number} start - The start index.
   * @param {number} stop - The stop index.
   * @returns {Promise<string[]>} The range of elements.
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this._redis.lrange(key, start, stop);
  }

  /**
   * Returns the length of a list.
   * @param {string} key - The key of the list.
   * @returns {Promise<number>} The length of the list.
   */
  async llen(key: string): Promise<number> {
    return this._redis.llen(key);
  }

  /**
   * Removes elements from a list.
   * @param {string} key - The key of the list.
   * @param {number} count - Number of occurrences to remove.
   * @param {string} value - The value to remove.
   * @returns {Promise<number>} The number of removed elements.
   */
  async lrem(key: string, count: number, value: string): Promise<number> {
    return this._redis.lrem(key, count, value);
  }

  /**
   * Verifies Redis connection with timeout and fails fast if unavailable
   * @private
   */
  private async _verifyConnection(): Promise<void> {
    const TIMEOUT_MS = 5000; // 5 second timeout
    const testKey = `redis-startup-test-${Date.now()}`;
    const testValue = 'connection-test';

    try {
      const connectionTest = Promise.race([
        this._testRedisOperations(testKey, testValue),
        this._createTimeoutPromise(TIMEOUT_MS),
      ]);
      await connectionTest;
    } catch (error) {
      this._logger.error({
        message: '❌ Redis connection failed:',
        data: { error: error.message },
      });

      this._logger.error({
        message: '🚨 STOPPING APPLICATION - Redis is required for operation',
      });

      process.exit(1); // Hard stop the application
    }
  }

  /**
   * Test Redis read/write operations
   * @param {string} testKey - The key to test the read/write operations on.
   * @param {string} testValue - The value to test the read/write operations on.
   * @private
   */
  private async _testRedisOperations(
    testKey: string,
    testValue: string,
  ): Promise<void> {
    const startTime = Date.now();

    // Test write
    await this._redis.set(testKey, testValue);

    // Test read
    const retrievedValue = await this._redis.get(testKey);

    if (retrievedValue !== testValue) {
      throw new Error(
        `Redis read/write test failed. Expected: ${testValue}, Got: ${retrievedValue}`,
      );
    }

    // Clean up
    await this._redis.del(testKey);

    const responseTime = Date.now() - startTime;
    console.log(`✅ Redis operations completed in ${responseTime}ms`);
  }

  /**
   * Create a timeout promise that rejects after specified milliseconds
   * @param {number} timeoutMs - The number of milliseconds to wait before rejecting the promise.
   * @private
   */
  private _createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Redis connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }
}
