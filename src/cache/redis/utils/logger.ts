import type { Logger } from "@nestjs/common";

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

/**
 * Function used to format the log message.
 * @param {LoggerInput} input - The logger input.
 * @returns {string} The formatted log message.
 */
function formatLogMessage(input: LoggerInput): string {
  if (!input.data || Object.keys(input.data).length === 0) {
    return input.message;
  }
  return `${input.message} - ${JSON.stringify(input.data)}`;
}

/**
 * Function used to adapt the logger to the StandardLogger interface.
 * @param {Logger} logger - The logger to adapt.
 * @returns {StandardLogger} The adapted logger.
 */
export function adaptLogger(logger: Logger): StandardLogger {
  return {
    // eslint-disable-next-line ts/no-explicit-any
    setContext: (logger as any).setContext ?? (() => {}),
    info: (input: LoggerInput) => logger.log(formatLogMessage(input)),
    error: (input: LoggerInput) => logger.error(formatLogMessage(input)),
    warn: (input: LoggerInput) => logger.warn(formatLogMessage(input)),
    debug: (input: LoggerInput) => logger.debug(formatLogMessage(input)),
  };
}
