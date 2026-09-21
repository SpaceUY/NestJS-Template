import { Cluster, Redis } from 'ioredis';
import { CACHE_ERRORS, CacheError } from '../../abstract/cache.error';
import { StandardLogger } from '../utils/logger';
import { RedisCacheKeysExtension } from './redis-cache-keys.extension';

describe('RedisCacheKeysExtension', () => {
  const redis = { keys: jest.fn() };
  const logger: StandardLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  let extension: RedisCacheKeysExtension;

  beforeEach(() => {
    extension = new RedisCacheKeysExtension(
      redis as unknown as Redis | Cluster,
      logger,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('returns the matching keys', async () => {
    redis.keys.mockResolvedValue(['session:1', 'session:2']);

    await expect(extension.keys('session:*')).resolves.toEqual([
      'session:1',
      'session:2',
    ]);
    expect(redis.keys).toHaveBeenCalledWith('session:*');
  });

  it('maps a driver failure to KEYS_FAILED and keeps the pattern as data', async () => {
    redis.keys.mockRejectedValue(new Error('ECONNRESET'));

    const error = (await extension
      .keys('session:*')
      .catch((e: unknown) => e)) as CacheError;

    expect(error).toBeInstanceOf(CacheError);
    expect(error.code).toBe(CACHE_ERRORS.KEYS_FAILED);
    expect(error.data).toEqual({ pattern: 'session:*' });
  });
});
