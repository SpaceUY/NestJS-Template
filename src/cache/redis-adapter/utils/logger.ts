import type { Logger } from '@nestjs/common';

export interface LoggerInput {
  message: string;
  data?: Record<string, unknown>;
}

export interface StandardLogger {
  setContext: (context: string) => void;
  info: (input: LoggerInput) => void;
  error: (input: LoggerInput) => void;
  warn: (input: LoggerInput) => void;
  debug: (input: LoggerInput) => void;
}

function formatLogMessage(input: LoggerInput): string {
  if (!input.data || Object.keys(input.data).length === 0) {
    return input.message;
  }
  return `${input.message} - ${JSON.stringify(input.data)}`;
}

export function adaptLogger(logger: Logger): StandardLogger {
  // `Logger` gained `setContext` only in some Nest versions, so it is read
  // through a narrowing cast rather than assumed to exist.
  const withSetContext = logger as { setContext?: (context: string) => void };

  return {
    setContext: withSetContext.setContext ?? (() => {}),
    info: (input: LoggerInput) => logger.log(formatLogMessage(input)),
    error: (input: LoggerInput) => logger.error(formatLogMessage(input)),
    warn: (input: LoggerInput) => logger.warn(formatLogMessage(input)),
    debug: (input: LoggerInput) => logger.debug(formatLogMessage(input)),
  };
}
