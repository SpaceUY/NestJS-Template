import { LoggerService } from '../abstract/logger.service';
import { LogInput } from '../abstract/logger.interfaces';

/**
 * Winston adapter. Requires `winston` to be installed:
 *   pnpm add winston
 */
export class WinstonLoggerAdapter extends LoggerService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private winston: any;
  private context: string;

  constructor(context = 'App') {
    super();
    this.context = context;
    // Dynamic require keeps winston an optional peer dependency.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const w = require('winston');
    this.winston = w.createLogger({
      transports: [new w.transports.Console()],
      format: w.format.combine(w.format.timestamp(), w.format.json()),
    });
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(input: LogInput): void {
    this.winston.info({
      context: this.context,
      ...input.data,
      message: input.message,
    });
    this.telemetryHook?.('log', input, this.context);
  }

  warn(input: LogInput): void {
    this.winston.warn({
      context: this.context,
      ...input.data,
      message: input.message,
    });
    this.telemetryHook?.('warn', input, this.context);
  }

  error(input: LogInput): void {
    this.winston.error({
      context: this.context,
      ...input.data,
      message: input.message,
    });
    this.telemetryHook?.('error', input, this.context);
  }

  debug(input: LogInput): void {
    this.winston.debug({
      context: this.context,
      ...input.data,
      message: input.message,
    });
    this.telemetryHook?.('debug', input, this.context);
  }
}
