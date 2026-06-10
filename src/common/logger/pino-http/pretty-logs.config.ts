/**
 * Pino options for human-readable colourised output. Intended for local
 * development. Requires `pino-pretty` to be installed:
 *   pnpm add -D pino-pretty
 *
 * Pass to `LoggerModule.forRoot({ pinoHttp: prettyLogsConfig(logLevel) })`
 * from `nestjs-pino`.
 */
export function prettyLogsConfig(logLevel: string) {
  return {
    autoLogging: false,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        minimumLevel: logLevel,
        messageFormat: '[{time}] [{context}] {levelLabel}: {message}{dataStr}',
        levelLabel: true,
        translateTime: 'HH:MM:ss.l',
        singleLine: false,
        hideObject: true,
      },
    },
    level: logLevel,
    messageKey: 'message',
    formatters: {
      level: (label: string) => ({ level: label, levelLabel: label.toUpperCase() }),
      log: (object: Record<string, unknown>) => {
        let dataStr = '';
        if (object.data && typeof object.data === 'object') {
          try {
            dataStr = ` - ${JSON.stringify(object.data)}`;
          } catch {
            dataStr = '';
          }
        }
        return { ...object, dataStr };
      },
    },
    mixin: () => ({ context: 'App' }),
  };
}
