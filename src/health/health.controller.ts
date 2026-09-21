import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorFunction,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { CacheHealthIndicator } from './cache.health-indicator';
import { DATABASE_PING_TIMEOUT_MS } from './health.const';

/**
 * Two endpoints, because orchestrators ask two different questions.
 *
 * `GET /health` is readiness: can this instance serve traffic *right now*,
 * dependencies included. That is what a load balancer target group polls.
 *
 * `GET /health/live` is liveness: is the process itself alive. It touches no
 * dependency on purpose — a container that restarts because Postgres blinked
 * turns one outage into two.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly cache: CacheHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness: the process and every dependency it needs to serve',
  })
  readiness(): Promise<HealthCheckResult> {
    const indicators: HealthIndicatorFunction[] = [
      () =>
        this.database.pingCheck('database', {
          timeout: DATABASE_PING_TIMEOUT_MS,
        }),
    ];

    // Left out entirely when no cache is registered, rather than reported up.
    if (this.cache.isConfigured()) {
      indicators.push(() => this.cache.check());
    }

    return this.health.check(indicators);
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness: the process is running. No dependencies.',
  })
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
