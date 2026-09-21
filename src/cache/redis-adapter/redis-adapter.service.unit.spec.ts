import { Logger } from '@nestjs/common';
import { CACHE_ERRORS, CacheError } from '../abstract/cache.error';
import { RedisAdapterConfig } from './redis-adapter-config.interface';
import { StandardLogger } from './utils/logger';
import { createRedisClient, verifyConnection } from './client';
import { RedisCacheAdapterService } from './redis-adapter.service';

jest.mock('./client');

const mockedCreate = createRedisClient as jest.MockedFunction<
  typeof createRedisClient
>;
const mockedVerify = verifyConnection as jest.MockedFunction<
  typeof verifyConnection
>;

describe('RedisCacheAdapterService', () => {
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    flushall: jest.fn(),
  };

  const logger: StandardLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const config = {
    protocol: 'redis',
    host: 'localhost',
    port: 6379,
    password: 'a-password',
    logger,
  } as unknown as RedisAdapterConfig;

  let service: RedisCacheAdapterService;

  beforeEach(() => {
    mockedCreate.mockReturnValue(redis as never);
    service = new RedisCacheAdapterService(config);
  });

  afterEach(() => jest.clearAllMocks());

  it('builds its client from the config and exposes it', () => {
    expect(mockedCreate).toHaveBeenCalledWith(config);
    expect(service.client).toBe(redis);
    expect(service.logger).toBe(logger);
  });

  it('falls back to a Nest logger when the config brings none', () => {
    const debug = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => {});
    const withoutLogger = { ...(config as unknown as Record<string, unknown>) };
    delete withoutLogger.logger;

    const fallback = new RedisCacheAdapterService(
      withoutLogger as unknown as RedisAdapterConfig,
    );
    fallback.logger.debug({ message: 'hello' });

    expect(debug).toHaveBeenCalledWith('hello');
    debug.mockRestore();
  });

  it('verifies the connection on module init', async () => {
    await service.onModuleInit();

    expect(mockedVerify).toHaveBeenCalledWith(redis, logger);
  });

  describe('get', () => {
    it('returns the stored value', async () => {
      redis.get.mockResolvedValue('value');

      await expect(service.get('key')).resolves.toBe('value');
      expect(redis.get).toHaveBeenCalledWith('key');
    });

    it('returns null for a missing key rather than throwing', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.get('key')).resolves.toBeNull();
    });

    it('maps a driver failure to GET_FAILED', async () => {
      redis.get.mockRejectedValue(new Error('ECONNRESET'));

      const error = (await service
        .get('key')
        .catch((e: unknown) => e)) as CacheError;

      expect(error).toBeInstanceOf(CacheError);
      expect(error.code).toBe(CACHE_ERRORS.GET_FAILED);
      expect(error.data).toEqual({ key: 'key' });
    });
  });

  describe('set', () => {
    it('sends no expiry when no ttl is given', async () => {
      await service.set('key', 'value');

      expect(redis.set).toHaveBeenCalledWith('key', 'value');
    });

    it('sends EX with the ttl when one is given', async () => {
      await service.set('key', 'value', 60);

      expect(redis.set).toHaveBeenCalledWith('key', 'value', 'EX', 60);
    });

    it('maps a driver failure to SET_FAILED without echoing the value', async () => {
      redis.set.mockRejectedValue(new Error('ECONNRESET'));

      const error = (await service
        .set('key', 'a-secret-value')
        .catch((e: unknown) => e)) as CacheError;

      expect(error.code).toBe(CACHE_ERRORS.SET_FAILED);
      expect(JSON.stringify(error.data)).not.toContain('a-secret-value');
    });
  });

  describe('del and clear', () => {
    it('spreads the keys into del', async () => {
      await service.del('a', 'b');

      expect(redis.del).toHaveBeenCalledWith('a', 'b');
    });

    it('maps a failed del to DEL_FAILED', async () => {
      redis.del.mockRejectedValue(new Error('ECONNRESET'));

      const error = (await service
        .del('a')
        .catch((e: unknown) => e)) as CacheError;

      expect(error.code).toBe(CACHE_ERRORS.DEL_FAILED);
    });

    it('clear flushes everything', async () => {
      await service.clear();

      expect(redis.flushall).toHaveBeenCalled();
    });

    it('maps a failed clear to CLEAR_FAILED', async () => {
      redis.flushall.mockRejectedValue(new Error('ECONNRESET'));

      const error = (await service
        .clear()
        .catch((e: unknown) => e)) as CacheError;

      expect(error.code).toBe(CACHE_ERRORS.CLEAR_FAILED);
    });
  });

  it('never writes a cached value to the debug log', async () => {
    redis.get.mockResolvedValue('value');
    redis.set.mockResolvedValue('OK');

    await service.set('key', 'a-secret-value', 60);
    await service.get('key');

    const logged = JSON.stringify((logger.debug as jest.Mock).mock.calls);
    expect(logged).toContain('key');
    expect(logged).not.toContain('a-secret-value');
  });
});
