import {
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorFunction,
  HealthIndicatorResult,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { CacheHealthIndicator } from './cache.health-indicator';
import { DATABASE_PING_TIMEOUT_MS } from './health.const';

/**
 * Runs whatever indicator functions the controller handed over, so the assertions
 * below are about which dependencies were actually probed, not about terminus.
 */
function makeHealthService(): {
  service: HealthCheckService;
  ran: () => Promise<string[]>;
} {
  let captured: HealthIndicatorFunction[] = [];

  const service = {
    check: jest.fn(async (indicators: HealthIndicatorFunction[]) => {
      captured = indicators;
      return { status: 'ok' } as HealthCheckResult;
    }),
  } as unknown as HealthCheckService;

  // `HealthIndicatorFunction` is a union in terminus 12: a thunk, or a bare
  // `HealthCheckAttempt` builder, which is a thenable rather than a callable.
  // The controller only ever hands over thunks; this narrows to that arm
  // instead of casting, so the day it stops being true the test says so.
  const ran = async (): Promise<string[]> => {
    const results = await Promise.all(
      captured.map((indicator) =>
        typeof indicator === 'function' ? indicator() : indicator,
      ),
    );
    return results.flatMap((result: HealthIndicatorResult) =>
      Object.keys(result),
    );
  };

  return { service, ran };
}

describe('HealthController', () => {
  // `pingCheck` no longer returns the result: terminus 12 returns a
  // `HealthCheckAttempt` builder that only runs once something awaits it, so
  // the double has to be chainable and thenable, not a resolved promise.
  const withTimeout = jest
    .fn()
    .mockResolvedValue({ database: { status: 'up' } });
  const database = {
    pingCheck: jest.fn(() => ({ withTimeout })),
  } as unknown as jest.Mocked<TypeOrmHealthIndicator>;

  beforeEach(() => jest.clearAllMocks());

  describe('readiness', () => {
    it('probes the database with the configured timeout', async () => {
      const { service, ran } = makeHealthService();
      const cache = {
        isConfigured: () => false,
        check: jest.fn(),
      } as unknown as CacheHealthIndicator;

      await new HealthController(service, database, cache).readiness();
      await ran();

      expect(database.pingCheck).toHaveBeenCalledWith('database');
      expect(withTimeout).toHaveBeenCalledWith(DATABASE_PING_TIMEOUT_MS);
    });

    it('includes the cache when one is registered', async () => {
      const { service, ran } = makeHealthService();
      const cache = {
        isConfigured: () => true,
        check: jest.fn().mockResolvedValue({ cache: { status: 'up' } }),
      } as unknown as CacheHealthIndicator;

      await new HealthController(service, database, cache).readiness();

      expect(await ran()).toEqual(['database', 'cache']);
    });

    it('leaves the cache out entirely when none is registered', async () => {
      const { service, ran } = makeHealthService();
      const check = jest.fn();
      const cache = {
        isConfigured: () => false,
        check,
      } as unknown as CacheHealthIndicator;

      await new HealthController(service, database, cache).readiness();

      // Not reported as up — absent. A dependency that does not exist must not
      // appear healthy.
      expect(await ran()).toEqual(['database']);
      expect(check).not.toHaveBeenCalled();
    });
  });

  describe('liveness', () => {
    it('answers ok without touching any dependency', () => {
      const { service } = makeHealthService();
      const check = jest.fn();
      const cache = {
        isConfigured: jest.fn(),
        check,
      } as unknown as CacheHealthIndicator;

      const result = new HealthController(service, database, cache).liveness();

      expect(result).toEqual({ status: 'ok' });
      // A container that restarts because Postgres blinked turns one outage
      // into two.
      expect(service.check).not.toHaveBeenCalled();
      expect(database.pingCheck).not.toHaveBeenCalled();
      expect(check).not.toHaveBeenCalled();
    });
  });
});
