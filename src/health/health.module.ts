import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { CacheHealthIndicator } from './cache.health-indicator';
import { HealthController } from './health.controller';

/**
 * No `forRoot`: this module configures nothing and swaps no provider, so the
 * dynamic-module shape the adapter modules use would be ceremony. Import it
 * and the two endpoints exist.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [CacheHealthIndicator],
})
export class HealthModule {}
