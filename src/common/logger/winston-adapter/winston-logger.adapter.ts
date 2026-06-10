import winston, { Logger } from 'winston';
import { LoggerService } from '../abstract/logger.service';
import { LogInput } from '../abstract/logger.interfaces';

/**
 * Winston adapter. Requires `winston` to be installed:
 *   pnpm add winston
 */
export class WinstonLoggerAdapter extends LoggerService {
  private readonly winston: Logger;
  private context: string;

  constructor(context = 'App', options: winston.LoggerOptions = {}) {
    super();
    this.context = context;
    this.winston = winston.createLogger({
      transports: [new winston.transports.Console()],
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      ...options,
    });
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(input: LogInput): void {
    this.winston.info(this._payload(input));
    this.emitTelemetry('log', input, this.context);
  }

  warn(input: LogInput): void {
    this.winston.warn(this._payload(input));
    this.emitTelemetry('warn', input, this.context);
  }

  error(input: LogInput): void {
    this.winston.error(this._payload(input));
    this.emitTelemetry('error', input, this.context);
  }

  debug(input: LogInput): void {
    this.winston.debug(this._payload(input));
    this.emitTelemetry('debug', input, this.context);
  }

  private _payload(input: LogInput): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      context: this.context,
      ...input.data,
      message: input.message,
    };
    if (input.error !== undefined) {
      payload.error =
        input.error instanceof Error
          ? (input.error.stack ?? input.error.message)
          : String(input.error);
    }
    return payload;
  }
}
