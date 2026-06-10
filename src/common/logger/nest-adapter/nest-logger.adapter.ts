import { Logger } from '@nestjs/common';
import { LoggerService } from '../abstract/logger.service';
import { LogInput } from '../abstract/logger.interfaces';

export class NestLoggerAdapter extends LoggerService {
  private readonly logger: Logger;

  constructor(context = 'App') {
    super();
    this.logger = new Logger(context);
  }

  setContext(context: string): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.logger as any).context = context;
  }

  log(input: LogInput): void {
    this.logger.log(this._format(input));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.telemetryHook?.('log', input, (this.logger as any).context ?? 'App');
  }

  warn(input: LogInput): void {
    this.logger.warn(this._format(input));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.telemetryHook?.('warn', input, (this.logger as any).context ?? 'App');
  }

  error(input: LogInput): void {
    this.logger.error(this._format(input));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.telemetryHook?.('error', input, (this.logger as any).context ?? 'App');
  }

  debug(input: LogInput): void {
    this.logger.debug(this._format(input));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.telemetryHook?.('debug', input, (this.logger as any).context ?? 'App');
  }

  private _format(input: LogInput): string {
    if (!input.data || Object.keys(input.data).length === 0) {
      return input.message;
    }
    return `${input.message} - ${JSON.stringify(input.data)}`;
  }
}
