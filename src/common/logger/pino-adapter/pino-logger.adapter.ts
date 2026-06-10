import pino, { Logger } from 'pino';
import { LoggerService } from '../abstract/logger.service';
import { LogInput } from '../abstract/logger.interfaces';

/**
 * Pino adapter. Requires `pino` to be installed:
 *   pnpm add pino
 *
 * Pass a pino options object (e.g. from configs/) as the second argument to
 * control output format, level, transports, etc.
 */
export class PinoLoggerAdapter extends LoggerService {
  private readonly pino: Logger;
  private context: string;

  constructor(context = 'App', options: pino.LoggerOptions = {}) {
    super();
    this.context = context;
    this.pino = pino(options);
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(input: LogInput): void {
    this.pino.info(this._payload(input), input.message);
    this.emitTelemetry('log', input, this.context);
  }

  warn(input: LogInput): void {
    this.pino.warn(this._payload(input), input.message);
    this.emitTelemetry('warn', input, this.context);
  }

  error(input: LogInput): void {
    this.pino.error(this._payload(input), input.message);
    this.emitTelemetry('error', input, this.context);
  }

  debug(input: LogInput): void {
    this.pino.debug(this._payload(input), input.message);
    this.emitTelemetry('debug', input, this.context);
  }

  private _payload(input: LogInput): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      context: this.context,
      ...input.data,
    };
    if (input.error !== undefined) {
      payload.error =
        input.error instanceof Error ? input.error : String(input.error);
    }
    return payload;
  }
}
