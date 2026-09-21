import { HealthIndicatorService } from '@nestjs/terminus';
import { CacheHealthIndicator } from './cache.health-indicator';
import { CACHE_PING_TIMEOUT_MS, CACHE_PROBE_KEY } from './health.const';
import { CacheService } from '../cache/abstract/cache.service';
import { LoggerService } from '../common/observability/logger/abstract/logger.service';

type LoggerDouble = jest.Mocked<Pick<LoggerService, 'error' | 'setContext'>>;

function makeLogger(): LoggerDouble {
  return { error: jest.fn(), setContext: jest.fn() };
}

function makeIndicator(
  get: jest.Mock,
  logger?: LoggerDouble,
): CacheHealthIndicator {
  return new CacheHealthIndicator(
    new HealthIndicatorService(),
    { get } as unknown as CacheService,
    logger as unknown as LoggerService,
  );
}

describe('CacheHealthIndicator', () => {
  describe('isConfigured', () => {
    it('is false when no CacheService is registered', () => {
      const indicator = new CacheHealthIndicator(new HealthIndicatorService());

      expect(indicator.isConfigured()).toBe(false);
    });

    it('is true when a CacheService is registered', () => {
      expect(makeIndicator(jest.fn()).isConfigured()).toBe(true);
    });
  });

  describe('check', () => {
    it('reports up when the probe key round-trips', async () => {
      const get = jest.fn().mockResolvedValue(null);

      const result = await makeIndicator(get).check();

      expect(result.cache.status).toBe('up');
      // A miss is a pass: the probe proves reachability, not content.
      expect(get).toHaveBeenCalledWith(CACHE_PROBE_KEY);
    });

    it('reports down when the cache throws', async () => {
      const get = jest
        .fn()
        .mockRejectedValue(new Error('connect ECONNREFUSED'));

      const result = await makeIndicator(get).check();

      expect(result.cache.status).toBe('down');
    });

    it('reports the error class, never the provider prose (T4)', async () => {
      // ioredis error text carries the host, port and sometimes the password.
      const leaky = new Error(
        'connect ECONNREFUSED 10.0.0.4:6379 (auth: hunter2)',
      );
      const get = jest.fn().mockRejectedValue(leaky);

      const result = await makeIndicator(get).check();

      expect(result.cache).toMatchObject({ status: 'down', reason: 'Error' });
      expect(JSON.stringify(result)).not.toContain('hunter2');
      expect(JSON.stringify(result)).not.toContain('10.0.0.4');
    });

    it('logs the failure, because the global filter strips it from the body', async () => {
      const logger = makeLogger();
      const get = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await makeIndicator(get, logger).check();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'cache health probe failed',
          data: expect.objectContaining({ indicator: 'cache', kind: 'Error' }),
        }),
      );
    });

    it('never puts the provider prose in the log line either (T4)', async () => {
      const logger = makeLogger();
      const leaky = new Error(
        'connect ECONNREFUSED 10.0.0.4:6379 (auth: hunter2)',
      );

      await makeIndicator(jest.fn().mockRejectedValue(leaky), logger).check();

      const logged = JSON.stringify(logger.error.mock.calls);
      expect(logged).not.toContain('hunter2');
      expect(logged).not.toContain('10.0.0.4');
    });

    it('does not log on the happy path', async () => {
      const logger = makeLogger();

      await makeIndicator(jest.fn().mockResolvedValue('1'), logger).check();

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('reports down when the read hangs past the timeout', async () => {
      jest.useFakeTimers();
      try {
        const get = jest.fn().mockReturnValue(new Promise(() => {}));
        const pending = makeIndicator(get).check();

        await jest.advanceTimersByTimeAsync(CACHE_PING_TIMEOUT_MS + 1);
        const result = await pending;

        expect(result.cache.status).toBe('down');
      } finally {
        jest.useRealTimers();
      }
    });

    it('clears its timer on the happy path, so the event loop can close (H7)', async () => {
      jest.useFakeTimers();
      try {
        const clearSpy = jest.spyOn(global, 'clearTimeout');

        await makeIndicator(jest.fn().mockResolvedValue(null)).check();

        expect(clearSpy).toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
