import { trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { LoggerService } from '../abstract/logger.service';
import { LogInput, LogTelemetryHook } from '../abstract/logger.interfaces';
import { TraceContextLoggerDecorator } from './trace-context-logger.decorator';

class FakeLogger extends LoggerService {
  calls: { level: string; input: LogInput }[] = [];

  setContext(): void {
    // no-op fake
  }

  log(input: LogInput): void {
    this.calls.push({ level: 'log', input });
  }

  warn(input: LogInput): void {
    this.calls.push({ level: 'warn', input });
  }

  error(input: LogInput): void {
    this.calls.push({ level: 'error', input });
  }

  debug(input: LogInput): void {
    this.calls.push({ level: 'debug', input });
  }
}

describe('TraceContextLoggerDecorator', () => {
  let inner: FakeLogger;
  let decorator: TraceContextLoggerDecorator;
  let provider: NodeTracerProvider;

  beforeEach(() => {
    inner = new FakeLogger();
    decorator = new TraceContextLoggerDecorator(inner);
    provider = new NodeTracerProvider();
    provider.register();
  });

  afterEach(async () => {
    await provider.shutdown();
    trace.disable();
  });

  it('passes the input through unchanged when there is no active span', () => {
    decorator.log({ message: 'hello' });

    expect(inner.calls).toEqual([{ level: 'log', input: { message: 'hello' } }]);
  });

  it('enriches data with traceId/spanId when a span is active', () => {
    const tracer = trace.getTracer('test');

    tracer.startActiveSpan('test-span', (span) => {
      decorator.log({ message: 'hello', data: { foo: 'bar' } });
      span.end();
    });

    expect(inner.calls).toHaveLength(1);
    const loggedInput = inner.calls[0].input;
    expect(loggedInput.data?.foo).toBe('bar');
    expect(typeof loggedInput.data?.traceId).toBe('string');
    expect(typeof loggedInput.data?.spanId).toBe('string');
  });

  it('delegates to the wrapped instance for the matching level', () => {
    decorator.warn({ message: 'careful' });
    decorator.error({ message: 'broken' });
    decorator.debug({ message: 'details' });

    expect(inner.calls.map((c) => c.level)).toEqual(['warn', 'error', 'debug']);
  });

  it('relays setContext to the wrapped instance', () => {
    const setContextSpy = jest.spyOn(inner, 'setContext');

    decorator.setContext('MyContext');

    expect(setContextSpy).toHaveBeenCalledWith('MyContext');
  });

  it('fires the outer telemetryHook with the enriched input, not the original', () => {
    const hook: LogTelemetryHook = jest.fn();
    decorator.withTelemetry(hook);
    decorator.setContext('TestContext');

    const tracer = trace.getTracer('test');
    tracer.startActiveSpan('test-span', (span) => {
      decorator.log({ message: 'hello' });
      span.end();
    });

    expect(hook).toHaveBeenCalledTimes(1);
    const [level, input, context] = (hook as jest.Mock).mock.calls[0];
    expect(level).toBe('log');
    expect(context).toBe('TestContext');
    expect(typeof input.data?.traceId).toBe('string');
  });
});
