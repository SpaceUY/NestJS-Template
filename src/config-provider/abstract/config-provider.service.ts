import { LoggerService } from '../../common/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/logger/nest-adapter/nest-logger.adapter';

export abstract class ConfigProviderService {
  protected logger: LoggerService = new NestLoggerAdapter(
    this.constructor.name,
  );

  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  abstract get(key: string): Promise<string | undefined>;
  abstract getOrThrow(key: string): Promise<string>;
}
