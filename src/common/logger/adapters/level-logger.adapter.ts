import { Logger } from '@nestjs/common';

export interface LevelLogger {
  debug?(message: string, meta?: Record<string, unknown>): void;
  info?(message: string, meta?: Record<string, unknown>): void;
  warn?(message: string, meta?: Record<string, unknown>): void;
  error?(message: string, meta?: Record<string, unknown>): void;
}

function formatMessage(
  message: string,
  meta?: Record<string, unknown>,
): string {
  if (!meta || Object.keys(meta).length === 0) {
    return message;
  }
  return `${message} - ${JSON.stringify(meta)}`;
}

export function createLevelLogger(context = 'App'): LevelLogger {
  const nestLogger = new Logger(context);
  return {
    debug: (message: string, meta?: Record<string, unknown>) =>
      nestLogger.debug(formatMessage(message, meta)),
    info: (message: string, meta?: Record<string, unknown>) =>
      nestLogger.log(formatMessage(message, meta)),
    warn: (message: string, meta?: Record<string, unknown>) =>
      nestLogger.warn(formatMessage(message, meta)),
    error: (message: string, meta?: Record<string, unknown>) =>
      nestLogger.error(formatMessage(message, meta)),
  };
}
