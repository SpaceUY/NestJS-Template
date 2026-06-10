import pino from 'pino';

/**
 * Raw pino options for human-readable colourised output. Intended for local
 * development. Requires `pino-pretty` to be installed:
 *   pnpm add -D pino-pretty
 *
 * Usage:
 *   new PinoLoggerAdapter('App', prettyLogsConfig('debug'))
 */
export function prettyLogsConfig(logLevel: string): pino.LoggerOptions {
  return {
    level: logLevel,
    messageKey: 'message',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        messageFormat: '[{context}] {msg}',
        singleLine: false,
        ignore: 'pid,hostname',
      },
    },
    formatters: {
      level: (label: string) => ({ level: label.toUpperCase() }),
    },
  };
}
