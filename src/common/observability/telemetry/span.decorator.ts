import { trace, SpanStatusCode } from '@opentelemetry/api';

export function Span(name?: string): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    const spanName =
      name ?? `${target.constructor.name}.${String(propertyKey)}`;

    descriptor.value = function (this: unknown, ...args: unknown[]) {
      const tracer = trace.getTracer('nestjs-template');
      return tracer.startActiveSpan(spanName, (span) => {
        try {
          const result = original.apply(this, args);

          if (result instanceof Promise) {
            return result.then(
              (value) => {
                span.end();
                return value;
              },
              (error: unknown) => {
                span.recordException(error as Error);
                span.setStatus({ code: SpanStatusCode.ERROR });
                span.end();
                throw error;
              },
            );
          }

          span.end();
          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          span.end();
          throw error;
        }
      });
    };

    return descriptor;
  };
}
