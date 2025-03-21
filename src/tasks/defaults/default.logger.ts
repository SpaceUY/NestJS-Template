import { Injectable, Logger } from '@nestjs/common';
import { TaskLogger, type LoggerInput } from '../interfaces/logger.interface';

@Injectable()
export class DefaultTaskLogger implements TaskLogger {
  private readonly logger = new Logger(DefaultTaskLogger.name);

  setContext(context: string): void {
    (this.logger as any).setContext?.(context);
  }

  info(input: LoggerInput): void {
    if ((this.logger as any).info) {
      (this.logger as any).info(input);
      return;
    }
    this.logger.log(input);
  }

  warn(input: LoggerInput): void {
    this.logger.warn(input);
  }

  debug(input: LoggerInput): void {
    this.logger.debug(input);
  }

  error(input: LoggerInput): void {
    this.logger.error(input);
  }
}
