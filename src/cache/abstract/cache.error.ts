export const CACHE_ERRORS = {
  // Base operations
  GET_FAILED: 'CACHE_GET_FAILED',
  SET_FAILED: 'CACHE_SET_FAILED',
  DEL_FAILED: 'CACHE_DEL_FAILED',
  CLEAR_FAILED: 'CACHE_CLEAR_FAILED',

  // List extension
  LPUSH_FAILED: 'CACHE_LPUSH_FAILED',
  RPUSH_FAILED: 'CACHE_RPUSH_FAILED',
  LPOP_FAILED: 'CACHE_LPOP_FAILED',
  RPOP_FAILED: 'CACHE_RPOP_FAILED',
  LRANGE_FAILED: 'CACHE_LRANGE_FAILED',
  LLEN_FAILED: 'CACHE_LLEN_FAILED',
  LREM_FAILED: 'CACHE_LREM_FAILED',

  // Keys extension
  KEYS_FAILED: 'CACHE_KEYS_FAILED',
} as const;

export type CacheErrorCode = (typeof CACHE_ERRORS)[keyof typeof CACHE_ERRORS];

export class CacheError extends Error {
  constructor(
    public readonly code: CacheErrorCode,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CacheError';
  }
}
