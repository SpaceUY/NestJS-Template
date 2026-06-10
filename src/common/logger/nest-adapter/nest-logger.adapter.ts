import { Logger } from '@nestjs/common';
import { LoggerService } from '../abstract/logger.service';
import { LogInput } from '../abstract/logger.interfaces';

export class NestLoggerAdapter extends LoggerService {
  private readonly logger: Logger;
  private context: string;

  constructor(context = 'App') {
    super();
    this.context = context;
    this.logger = new Logger(context);
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(input: LogInput): void {
    this.logger.log(this._format(input), this.context);
    this.emitTelemetry('log', input, this.context);
  }

  warn(input: LogInput): void {
    this.logger.warn(this._format(input), this.context);
    this.emitTelemetry('warn', input, this.context);
  }

  error(input: LogInput): void {
    const stack = input.error instanceof Error ? input.error.stack : undefined;
    this.logger.error(this._format(input), stack, this.context);
    this.emitTelemetry('error', input, this.context);
  }

  debug(input: LogInput): void {
    this.logger.debug(this._format(input), this.context);
    this.emitTelemetry('debug', input, this.context);
  }

  private _format(input: LogInput): string {
    const data =
      input.error !== undefined
        ? { ...input.data, error: this._serializeError(input.error) }
        : input.data;

    if (!data || Object.keys(data).length === 0) {
      return input.message;
    }
    return `${input.message} - ${JSON.stringify(data)}`;
  }

  private _serializeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
