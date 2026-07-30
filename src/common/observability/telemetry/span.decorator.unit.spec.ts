import { SpanStatusCode, trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { Span } from './span.decorator';

describe('Span decorator', () => {
  let exporter: InMemorySpanExporter;
  let provider: NodeTracerProvider;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    provider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    provider.register();
  });

  afterEach(async () => {
    exporter.reset();
    await provider.shutdown();
    trace.disable();
  });

  it('wraps a sync method, ending the span and returning the value', () => {
    class Example {
      @Span()
      add(a: number, b: number): number {
        return a + b;
      }
    }

    const result = new Example().add(2, 3);

    expect(result).toBe(5);
    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe('Example.add');
    expect(spans[0].status.code).toBe(SpanStatusCode.UNSET);
  });

  it('wraps an async method, ending the span and resolving the value', async () => {
    class Example {
      @Span()
      async fetchValue(): Promise<string> {
        return 'value';
      }
    }

    const result = await new Example().fetchValue();

    expect(result).toBe('value');
    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe('Example.fetchValue');
  });

  it('uses a custom span name when provided', () => {
    class Example {
      @Span('CustomName')
      run(): void {
        return;
      }
    }

    new Example().run();

    expect(exporter.getFinishedSpans()[0].name).toBe('CustomName');
  });

  it('records the exception, sets error status, ends the span, and re-throws on a sync failure', () => {
    class Example {
      @Span()
      explode(): void {
        throw new Error('boom');
      }
    }

    expect(() => new Example().explode()).toThrow('boom');

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
    expect(spans[0].events.some((e) => e.name === 'exception')).toBe(true);
  });

  it('records the exception, sets error status, ends the span, and rejects on an async failure', async () => {
    class Example {
      @Span()
      async explodeAsync(): Promise<void> {
        throw new Error('boom async');
      }
    }

    await expect(new Example().explodeAsync()).rejects.toThrow('boom async');

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
  });
});
