import pino from 'pino';

/**
 * Raw pino options for structured JSON output. Intended for remote/production
 * environments where logs are ingested by a log aggregator.
 *
 * Usage:
 *   new PinoLoggerAdapter('App', jsonLogsConfig('info'))
 */
export function jsonLogsConfig(logLevel: string): pino.LoggerOptions {
  return {
    level: logLevel,
    messageKey: 'message',
    formatters: {
      level: (label: string) => {
        const levelMap: Record<string, string> = {
          10: 'TRACE',
          20: 'DEBUG',
          30: 'INFO',
          40: 'WARN',
          50: 'ERROR',
          60: 'FATAL',
        };
        return { level: levelMap[label] ?? label };
      },
    },
  };
}
