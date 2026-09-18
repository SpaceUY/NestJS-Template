import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/observability/logger/nest-adapter/nest-logger.adapter';

export abstract class ConfigProviderService {
  protected logger: LoggerService = new NestLoggerAdapter(
    this.constructor.name,
  );

  /**
   * Replaces the default logger, letting the module inject the container's
   * `LoggerService` after instantiation. `LoggerService` is registered as
   * `Scope.TRANSIENT`, so re-tagging the context here affects only this
   * adapter's own instance.
   *
   * @param {LoggerService} logger - Logger the adapter should use from now on.
   */
  setLogger(logger: LoggerService): void {
    logger.setContext(this.constructor.name);
    this.logger = logger;
  }

  abstract get(key: string): Promise<string | undefined>;
  abstract getOrThrow(key: string): Promise<string>;
}
