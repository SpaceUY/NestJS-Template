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

  /**
   * Fires the telemetry hook, if one is wired. A throwing hook must never take
   * down the calling code path, so failures are swallowed and reported to
   * stderr rather than propagated.
   */
  protected emitTelemetry(
    level: 'log' | 'warn' | 'error' | 'debug',
    input: LogInput,
    context: string,
  ): void {
    if (!this.telemetryHook) return;
    try {
      this.telemetryHook(level, input, context);
    } catch (error) {
      console.error('LoggerService telemetry hook threw:', error);
    }
  }

  abstract setContext(context: string): void;
  abstract log(input: LogInput): void;
  abstract warn(input: LogInput): void;
  abstract error(input: LogInput): void;
  abstract debug(input: LogInput): void;
}
