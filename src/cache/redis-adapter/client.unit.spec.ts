import { Cluster, Redis, RedisOptions } from 'ioredis';
import { RedisAdapterConfig } from './redis-adapter-config.interface';
import { StandardLogger } from './utils/logger';
import { createRedisClient, verifyConnection } from './client';

jest.mock('ioredis', () => ({
  Redis: jest.fn(),
  Cluster: jest.fn(),
}));

const MockedRedis = Redis as unknown as jest.Mock;
const MockedCluster = Cluster as unknown as jest.Mock;

const base = {
  protocol: 'redis' as const,
  host: 'cache.internal',
  port: 6379,
  password: 'a-password',
};

describe('createRedisClient', () => {
  afterEach(() => jest.clearAllMocks());

  it('builds a standalone client from the connection URL', () => {
    createRedisClient(base as RedisAdapterConfig);

    const [url] = MockedRedis.mock.calls[0] as [string, RedisOptions];
    expect(url).toBe('redis://:a-password@cache.internal:6379');
    expect(MockedCluster).not.toHaveBeenCalled();
  });

  describe('retry strategy', () => {
    const strategyOf = (
      config: Partial<RedisAdapterConfig> = {},
    ): ((times: number) => number | null) => {
      createRedisClient({ ...base, ...config } as RedisAdapterConfig);
      const [, options] = MockedRedis.mock.calls[0] as [string, RedisOptions];
      return options.retryStrategy as (times: number) => number | null;
    };

    it('waits the default delay while under the default retry ceiling', () => {
      expect(strategyOf()(0)).toBe(5000);
    });

    it('gives up once the retry ceiling is reached', () => {
      // Returning null is what stops ioredis from reconnecting forever.
      expect(strategyOf()(10)).toBeNull();
    });

    it('honours the configured delay and ceiling', () => {
      const strategy = strategyOf({
        reconnectionDelayMs: 100,
        reconnectionMaxRetries: 2,
      });

      expect(strategy(1)).toBe(100);
      expect(strategy(2)).toBeNull();
    });
  });

  describe('cluster mode', () => {
    it('builds a Cluster from the single seed node with the defaults', () => {
      createRedisClient({
        ...base,
        clusterMode: true,
      } as RedisAdapterConfig);

      expect(MockedRedis).not.toHaveBeenCalled();
      const [nodes, options] = MockedCluster.mock.calls[0] as [
        Array<{ host: string; port: number }>,
        { scaleReads: string; maxRedirections: number },
      ];
      expect(nodes).toEqual([{ host: 'cache.internal', port: 6379 }]);
      expect(options.scaleReads).toBe('master');
      expect(options.maxRedirections).toBe(16);
    });

    it('keeps the caller cluster options', () => {
      createRedisClient({
        ...base,
        clusterMode: true,
        clusterOptions: { scaleReads: 'all', maxRedirections: 3 },
      } as RedisAdapterConfig);

      const [, options] = MockedCluster.mock.calls[0] as [
        unknown,
        { scaleReads: string; maxRedirections: number },
      ];
      expect(options.scaleReads).toBe('all');
      expect(options.maxRedirections).toBe(3);
    });

    it('resolves DNS to the address it was given by default', () => {
      createRedisClient({
        ...base,
        clusterMode: true,
      } as RedisAdapterConfig);

      const [, options] = MockedCluster.mock.calls[0] as [
        unknown,
        {
          dnsLookup: (
            address: string,
            cb: (err: Error | null, address: string) => void,
          ) => void;
        },
      ];
      const seen: Array<[Error | null, string]> = [];
      options.dnsLookup('node-1.internal', (err, address) =>
        seen.push([err, address]),
      );

      expect(seen).toEqual([[null, 'node-1.internal']]);
    });
  });
});

describe('verifyConnection', () => {
  const logger: StandardLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const redis = { set: jest.fn(), get: jest.fn(), del: jest.fn() };
  let exit: jest.SpyInstance;

  beforeEach(() => {
    // verifyConnection races the probe against a 5s timeout; fake timers are
    // what let the timeout case run without waiting, and what make the
    // cleanup assertions below observable through jest.getTimerCount().
    jest.useFakeTimers();
    exit = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
    exit.mockRestore();
  });

  const run = (): Promise<void> =>
    verifyConnection(redis as unknown as Redis, logger);

  it('writes, reads back and cleans up its probe key', async () => {
    redis.get.mockResolvedValue('connection-test');

    await run();

    const [key, value] = redis.set.mock.calls[0] as [string, string];
    expect(key).toMatch(/^redis-startup-test-\d+$/);
    expect(value).toBe('connection-test');
    expect(redis.del).toHaveBeenCalledWith(key);
    expect(logger.info).toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  // Redis is a hard dependency: a cache that answers with the wrong value is
  // worse than no cache, so the process stops instead of booting degraded.
  it('stops the process when the probe reads back the wrong value', async () => {
    redis.get.mockResolvedValue('something-else');

    await run();

    expect(logger.error).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('stops the process when the driver fails', async () => {
    redis.set.mockRejectedValue(new Error('ECONNREFUSED'));

    await run();

    expect(exit).toHaveBeenCalledWith(1);
  });

  // Promise.race does not cancel the loser: a timer left armed keeps the event
  // loop alive for five seconds after a boot that already succeeded.
  it('clears the timeout once the probe succeeds', async () => {
    // clearAllMocks resets calls, not implementations: the rejection left by
    // the previous test would otherwise still be armed here.
    redis.set.mockResolvedValue('OK');
    redis.get.mockResolvedValue('connection-test');

    await run();

    expect(jest.getTimerCount()).toBe(0);
  });

  it('clears the timeout when the probe fails', async () => {
    redis.set.mockRejectedValue(new Error('ECONNREFUSED'));

    await run();

    expect(jest.getTimerCount()).toBe(0);
  });

  it('stops the process when the probe never answers', async () => {
    redis.set.mockReturnValue(new Promise(() => {}));

    const pending = run();
    await jest.advanceTimersByTimeAsync(5000);
    await pending;

    expect(exit).toHaveBeenCalledWith(1);
  });
});
