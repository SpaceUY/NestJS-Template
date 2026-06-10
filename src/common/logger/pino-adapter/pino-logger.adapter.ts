import pino, { Logger } from 'pino';
import { LoggerService } from '../abstract/logger.service';
import { LogInput } from '../abstract/logger.interfaces';

/**
 * Pino adapter. Requires `pino` to be installed:
 *   pnpm add pino
 *   pnpm add -D @types/pino
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
    this.pino.info({ context: this.context, ...input.data }, input.message);
    this.telemetryHook?.('log', input, this.context);
  }

  warn(input: LogInput): void {
    this.pino.warn({ context: this.context, ...input.data }, input.message);
    this.telemetryHook?.('warn', input, this.context);
  }

  error(input: LogInput): void {
    this.pino.error({ context: this.context, ...input.data }, input.message);
    this.telemetryHook?.('error', input, this.context);
  }

  debug(input: LogInput): void {
    this.pino.debug({ context: this.context, ...input.data }, input.message);
    this.telemetryHook?.('debug', input, this.context);
  }
}
