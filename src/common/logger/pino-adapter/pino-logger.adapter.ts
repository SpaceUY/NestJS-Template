import { LoggerService } from '../abstract/logger.service';
import { LogInput } from '../abstract/logger.interfaces';

/**
 * Pino adapter. Requires `pino` to be installed:
 *   pnpm add pino
 *   pnpm add -D @types/pino
 */
export class PinoLoggerAdapter extends LoggerService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pino: any;
  private context: string;

  constructor(context = 'App') {
    super();
    this.context = context;
    // Dynamic require keeps pino an optional peer dependency.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    this.pino = require('pino')();
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
