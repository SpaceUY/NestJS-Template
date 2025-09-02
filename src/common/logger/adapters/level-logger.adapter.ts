import { Logger } from '@nestjs/common';
import { adaptLogger } from '../standard-logger.interface';
import type { StandardLogger } from '../standard-logger.interface';

export interface LevelLogger {
  debug?(message: string, meta?: Record<string, unknown>): void;
  info?(message: string, meta?: Record<string, unknown>): void;
  warn?(message: string, meta?: Record<string, unknown>): void;
  error?(message: string, meta?: Record<string, unknown>): void;
}

export function createLevelLogger(context = 'App'): LevelLogger {
  const nestLogger = new Logger(context);
  const std: StandardLogger = adaptLogger(nestLogger);
  return {
    debug: (message: string, meta?: Record<string, unknown>) =>
      std.debug({ message, data: meta }),
    info: (message: string, meta?: Record<string, unknown>) =>
      std.info({ message, data: meta }),
    warn: (message: string, meta?: Record<string, unknown>) =>
      std.warn({ message, data: meta }),
    error: (message: string, meta?: Record<string, unknown>) =>
      std.error({ message, data: meta }),
  };
}
