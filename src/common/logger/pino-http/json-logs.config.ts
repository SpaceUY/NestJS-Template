/**
 * Pino options for structured JSON output. Intended for remote/production
 * environments where logs are ingested by a log aggregator.
 *
 * Pass to `LoggerModule.forRoot({ pinoHttp: jsonLogsConfig(logLevel) })`
 * from `nestjs-pino`.
 */
export function jsonLogsConfig(logLevel: string) {
  return {
    autoLogging: false,
    transport: undefined,
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
      log: (object: Record<string, unknown>) => {
        const { req, res, ...rest } = object;
        void req;
        void res;
        return rest;
      },
    },
    serializers: {
      req: () => undefined,
      res: () => undefined,
    },
  };
}
