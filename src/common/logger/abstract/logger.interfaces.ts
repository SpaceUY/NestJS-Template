export interface LogInput {
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Optional hook called after every log write. Intended for telemetry
 * integrations (e.g. OpenTelemetry, Datadog) that need to observe structured
 * log events without modifying individual adapters.
 */
export type LogTelemetryHook = (
  level: 'log' | 'warn' | 'error' | 'debug',
  input: LogInput,
  context: string,
) => void;
