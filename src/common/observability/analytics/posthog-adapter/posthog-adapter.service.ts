import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PostHog } from 'posthog-node';
import { AnalyticsService } from '../abstract/analytics.service';
import { CaptureEventInput } from '../abstract/analytics.interfaces';
import { PosthogAdapterConfig } from './posthog-adapter-config.interface';
import { LoggerService } from '../../logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../logger/nest-adapter/nest-logger.adapter';

@Injectable()
export class PosthogAdapterService
  extends AnalyticsService
  implements OnModuleDestroy
{
  private readonly client: PostHog;
  private readonly logger: LoggerService;

  constructor(config: PosthogAdapterConfig, logger?: LoggerService) {
    super();
    this.client = new PostHog(config.apiKey, { host: config.host });
    this.logger = logger ?? new NestLoggerAdapter(PosthogAdapterService.name);
  }

  capture(input: CaptureEventInput): void {
    try {
      this.client.capture({
        distinctId: input.distinctId,
        event: input.event,
        properties: input.properties,
      });
    } catch (error) {
      this.logger.error({
        message: 'PostHog capture failed',
        data: { event: input.event },
        error,
      });
    }
  }

  async isFeatureEnabled(key: string, distinctId: string): Promise<boolean> {
    const result = await this.client.isFeatureEnabled(key, distinctId);
    return result ?? false;
  }

  async getFeatureFlag(
    key: string,
    distinctId: string,
  ): Promise<string | boolean | undefined> {
    return this.client.getFeatureFlag(key, distinctId);
  }

  // `PostHog#shutdown()` (inherited from `PostHogCoreStateless` in
  // `@posthog/core`) is genuinely async: it awaits the internal event queue
  // drain before resolving. Awaiting it here is required for the flush to
  // actually complete before Nest proceeds with process teardown.
  async onModuleDestroy(): Promise<void> {
    await this.client.shutdown();
  }
}
