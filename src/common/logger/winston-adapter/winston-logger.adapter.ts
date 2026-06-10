import winston, { Logger } from 'winston';
import { LoggerService } from '../abstract/logger.service';
import { LogInput } from '../abstract/logger.interfaces';

/**
 * Winston adapter. Requires `winston` to be installed:
 *   pnpm add winston
 *   pnpm add -D @types/winston
 */
export class WinstonLoggerAdapter extends LoggerService {
  private readonly winston: Logger;
  private context: string;

  constructor(context = 'App', options: winston.LoggerOptions = {}) {
    super();
    this.context = context;
    this.winston = winston.createLogger({
      transports: [new winston.transports.Console()],
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      ...options,
    });
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(input: LogInput): void {
    this.winston.info({ context: this.context, ...input.data, message: input.message });
    this.telemetryHook?.('log', input, this.context);
  }

  warn(input: LogInput): void {
    this.winston.warn({ context: this.context, ...input.data, message: input.message });
    this.telemetryHook?.('warn', input, this.context);
  }

  error(input: LogInput): void {
    this.winston.error({ context: this.context, ...input.data, message: input.message });
    this.telemetryHook?.('error', input, this.context);
  }

  debug(input: LogInput): void {
    this.winston.debug({ context: this.context, ...input.data, message: input.message });
    this.telemetryHook?.('debug', input, this.context);
  }
}
