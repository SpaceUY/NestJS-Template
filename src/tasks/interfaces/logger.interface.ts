export interface LoggerInput {
  message: string;
  data?: Record<string, any>;
}

export interface TaskLogger {
  setContext(context: string): void;
  info(input: LoggerInput): void;
  warn(input: LoggerInput): void;
  debug(input: LoggerInput): void;
  error(input: LoggerInput): void;
}
