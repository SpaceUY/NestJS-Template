import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/core';
import { TaskLogger, type LoggerInput } from '../interfaces/logger.interface';

@Injectable()
export class DefaultTaskLogger implements TaskLogger {
  constructor(private readonly logger: Logger) {}

  setContext(context: string): void {
    this.logger.setContext(context);
  }

  info(input: LoggerInput): void {
    this.logger.info(input);
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