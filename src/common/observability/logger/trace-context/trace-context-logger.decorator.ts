import { trace } from '@opentelemetry/api';
import { LoggerService } from '../abstract/logger.service';
import { LogInput } from '../abstract/logger.interfaces';

type LogLevel = 'log' | 'warn' | 'error' | 'debug';

export class TraceContextLoggerDecorator extends LoggerService {
  private context = '';

  constructor(private readonly inner: LoggerService) {
    super();
  }

  setContext(context: string): void {
    this.context = context;
    this.inner.setContext(context);
  }

  log(input: LogInput): void {
    this.forward('log', input);
  }

  warn(input: LogInput): void {
    this.forward('warn', input);
  }

  error(input: LogInput): void {
    this.forward('error', input);
  }

  debug(input: LogInput): void {
    this.forward('debug', input);
  }

  private forward(level: LogLevel, input: LogInput): void {
    const enriched = this.withTraceContext(input);
    this.inner[level](enriched);
    this.emitTelemetry(level, enriched, this.context);
  }

  private withTraceContext(input: LogInput): LogInput {
    const spanContext = trace.getActiveSpan()?.spanContext();
    if (!spanContext) return input;

    return {
      ...input,
      data: {
        ...input.data,
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
      },
    };
  }
}
