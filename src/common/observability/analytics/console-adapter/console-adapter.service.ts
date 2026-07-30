import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../abstract/analytics.service';
import { CaptureEventInput } from '../abstract/analytics.interfaces';
import { LoggerService } from '../../logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../logger/nest-adapter/nest-logger.adapter';

@Injectable()
export class ConsoleAdapterService extends AnalyticsService {
  private readonly logger: LoggerService;

  constructor(logger?: LoggerService) {
    super();
    this.logger = logger ?? new NestLoggerAdapter(ConsoleAdapterService.name);
  }

  capture(input: CaptureEventInput): void {
    this.logger.log({
      message: 'Analytics event (console adapter, not sent)',
      data: {
        distinctId: input.distinctId,
        event: input.event,
        properties: input.properties,
      },
    });
  }

  async isFeatureEnabled(key: string, distinctId: string): Promise<boolean> {
    this.logger.debug({
      message: 'Feature flag check (console adapter, always false)',
      data: { key, distinctId },
    });
    return false;
  }

  async getFeatureFlag(
    key: string,
    distinctId: string,
  ): Promise<string | boolean | undefined> {
    this.logger.debug({
      message: 'Feature flag lookup (console adapter, always undefined)',
      data: { key, distinctId },
    });
    return undefined;
  }
}
