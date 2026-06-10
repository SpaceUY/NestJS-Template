import { LogInput, LogTelemetryHook } from './logger.interfaces';

/**
 * Contract all logger adapters must satisfy. Inject this token in other
 * modules — never a concrete adapter class — so the adapter can be swapped
 * without touching consumers.
 */
export abstract class LoggerService {
  protected telemetryHook?: LogTelemetryHook;

  withTelemetry(hook: LogTelemetryHook): this {
    this.telemetryHook = hook;
    return this;
  }

  abstract setContext(context: string): void;
  abstract log(input: LogInput): void;
  abstract warn(input: LogInput): void;
  abstract error(input: LogInput): void;
  abstract debug(input: LogInput): void;
}
