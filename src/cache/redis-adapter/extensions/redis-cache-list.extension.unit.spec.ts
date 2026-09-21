import { Cluster, Redis } from 'ioredis';
import { CACHE_ERRORS, CacheError } from '../../abstract/cache.error';
import { StandardLogger } from '../utils/logger';
import { RedisCacheListExtension } from './redis-cache-list.extension';

describe('RedisCacheListExtension', () => {
  const redis = {
    lpush: jest.fn(),
    rpush: jest.fn(),
    lpop: jest.fn(),
    rpop: jest.fn(),
    lrange: jest.fn(),
    llen: jest.fn(),
    lrem: jest.fn(),
  };

  const logger: StandardLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  let extension: RedisCacheListExtension;

  beforeEach(() => {
    extension = new RedisCacheListExtension(
      redis as unknown as Redis | Cluster,
      logger,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('pushes', () => {
    it('spreads an array into lpush and passes a single value through', async () => {
      redis.lpush.mockResolvedValue(3);

      await expect(extension.lpush('list', ['a', 'b'])).resolves.toBe(3);
      expect(redis.lpush).toHaveBeenCalledWith('list', 'a', 'b');

      await extension.lpush('list', 'a');
      expect(redis.lpush).toHaveBeenLastCalledWith('list', 'a');
    });

    it('spreads an array into rpush and passes a single value through', async () => {
      redis.rpush.mockResolvedValue(3);

      await expect(extension.rpush('list', ['a', 'b'])).resolves.toBe(3);
      expect(redis.rpush).toHaveBeenCalledWith('list', 'a', 'b');

      await extension.rpush('list', 'a');
      expect(redis.rpush).toHaveBeenLastCalledWith('list', 'a');
    });
  });

  it('delegates the read operations and returns what redis returns', async () => {
    redis.lpop.mockResolvedValue('left');
    redis.rpop.mockResolvedValue('right');
    redis.lrange.mockResolvedValue(['a', 'b']);
    redis.llen.mockResolvedValue(2);
    redis.lrem.mockResolvedValue(1);

    await expect(extension.lpop('list')).resolves.toBe('left');
    await expect(extension.rpop('list')).resolves.toBe('right');
    await expect(extension.lrange('list', 0, -1)).resolves.toEqual(['a', 'b']);
    await expect(extension.llen('list')).resolves.toBe(2);
    await expect(extension.lrem('list', 1, 'a')).resolves.toBe(1);

    expect(redis.lrange).toHaveBeenCalledWith('list', 0, -1);
    expect(redis.lrem).toHaveBeenCalledWith('list', 1, 'a');
  });

  // Every method turns a driver failure into a CacheError carrying its own
  // code, so a caller never sees an ioredis error (invariant `T3`).
  describe('driver failures', () => {
    it.each([
      ['lpush', () => extension.lpush('list', 'a'), CACHE_ERRORS.LPUSH_FAILED],
      ['rpush', () => extension.rpush('list', 'a'), CACHE_ERRORS.RPUSH_FAILED],
      ['lpop', () => extension.lpop('list'), CACHE_ERRORS.LPOP_FAILED],
      ['rpop', () => extension.rpop('list'), CACHE_ERRORS.RPOP_FAILED],
      [
        'lrange',
        () => extension.lrange('list', 0, -1),
        CACHE_ERRORS.LRANGE_FAILED,
      ],
      ['llen', () => extension.llen('list'), CACHE_ERRORS.LLEN_FAILED],
      ['lrem', () => extension.lrem('list', 1, 'a'), CACHE_ERRORS.LREM_FAILED],
    ])('maps a failed %s to its own code', async (method, call, code) => {
      (redis as Record<string, jest.Mock>)[method].mockRejectedValue(
        new Error('ECONNRESET'),
      );

      const error = await call().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(CacheError);
      expect((error as CacheError).code).toBe(code);
      expect((error as CacheError).message).not.toContain('ECONNRESET');
    });
  });

  it('logs the key but never the value being written', async () => {
    redis.lpush.mockResolvedValue(1);

    await extension.lpush('list', 'a-secret-value');

    const logged = JSON.stringify((logger.debug as jest.Mock).mock.calls);
    expect(logged).toContain('list');
    expect(logged).not.toContain('a-secret-value');
  });
});
