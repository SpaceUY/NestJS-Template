/**
 * This is a base interface for task status cache handlers.
 * It is used to abstract the cache implementation details from the task status manager.
 * If an implementation is not provided, the task status manager will not cache any values.
 */
export abstract class BaseTaskCacheHandler {
  /**
   * Set a value in the cache
   * @param {string} key - The key to set
   * @param {string} value - The value to store
   * @param {number} ttl ? - Optional time-to-live in miliseconds
   */
  abstract set(key: string, value: string, ttl?: number): Promise<void>;

  /**
   * Get a value from the cache
   * @param {string} key - The key to retrieve
   * @returns {Promise<string | undefined>} - The stored value or `undefined` if not found.
   */
  abstract get(key: string): Promise<string | undefined>;

  /**
   * Delete a value from the cache
   * @param {string} key - The key to delete
   */
  abstract delete(key: string): Promise<void>;
}
