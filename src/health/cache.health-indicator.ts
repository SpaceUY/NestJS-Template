import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { CacheService } from '../cache/abstract/cache.service';
import { LoggerService } from '../common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../common/observability/logger/nest-adapter/nest-logger.adapter';
import { CACHE_PING_TIMEOUT_MS, CACHE_PROBE_KEY } from './health.const';

/**
 * Probes the cache through `CacheService`, the abstraction, so the check keeps
 * working when the adapter behind it changes (`T1`). Nothing here imports
 * `ioredis`.
 *
 * `CacheService` is `@Optional()`: a project that lifts `src/health/` without
 * `src/cache/` still boots, and `isConfigured()` tells the controller to leave
 * the cache out of the check rather than report a dependency that does not
 * exist as healthy.
 */
@Injectable()
export class CacheHealthIndicator {
  private readonly logger: LoggerService;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Optional() @Inject(CacheService) private readonly cache?: CacheService,
    @Optional() @Inject(LoggerService) logger?: LoggerService,
  ) {
    this.logger = logger ?? new NestLoggerAdapter(CacheHealthIndicator.name);
    this.logger.setContext(CacheHealthIndicator.name);
  }

  /**
   * Whether a cache is registered at all.
   *
   * @returns {boolean} True when `CacheService` resolved.
   */
  isConfigured(): boolean {
    return this.cache !== undefined;
  }

  /**
   * Reads one key to prove the round trip. A miss is a pass — the probe is
   * about reachability, not content. A cache that never answers is as down as
   * one that refuses the connection, so the read races a timeout.
   *
   * @returns {Promise<HealthIndicatorResult<'cache'>>} Terminus result for the `cache` key.
   */
  async check(): Promise<HealthIndicatorResult<'cache'>> {
    const session = this.healthIndicatorService.check('cache');
    const startedAt = Date.now();

    try {
      await this._probeWithTimeout();
      return session.up({ responseTime: Date.now() - startedAt });
    } catch (error) {
      // T4: the class name, never the provider's prose. An ioredis connection
      // error reads `connect ECONNREFUSED 10.0.0.4:6379` and can carry the
      // password — neither the log line nor the response body may quote it.
      const kind = error instanceof Error ? error.name : 'UnknownError';

      // The global exception filter rebuilds error bodies field by field
      // (finding `C4`), so terminus's per-indicator detail never reaches the
      // client. Without this line a 503 from /health says only that something
      // is down. See this module's `## Known gaps`.
      this.logger.error({
        message: 'cache health probe failed',
        data: {
          indicator: 'cache',
          kind,
          responseTime: Date.now() - startedAt,
        },
      });

      return session.down({ reason: kind });
    }
  }

  /**
   * Races the cache read against the timeout, so a hung socket reports down
   * instead of holding the health endpoint open past its caller's patience.
   *
   * @returns {Promise<void>} Resolves when the read completes in time.
   * @throws {Error} When the read fails or outlives `CACHE_PING_TIMEOUT_MS`.
   */
  private async _probeWithTimeout(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;

    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('CacheProbeTimeout')),
        CACHE_PING_TIMEOUT_MS,
      );
    });

    try {
      await Promise.race([this.cache?.get(CACHE_PROBE_KEY), timeout]);
    } finally {
      // Finding `H7` was exactly this timer left uncleared, holding the event
      // loop open after a successful probe.
      if (timer) clearTimeout(timer);
    }
  }
}
