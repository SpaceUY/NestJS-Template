# OpenTelemetry Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add distributed tracing to the NestJS backend using only official `@opentelemetry/*` packages, with a first-party `@Span()` decorator for manual spans and full bidirectional log/trace correlation, backed by a local Jaeger instance for development.

**Architecture:** A dedicated bootstrap file (`src/tracing/tracing.bootstrap.ts`) initializes a `NodeSDK` with explicitly-named official instrumentations before `main.ts` imports anything else. The trace backend is fully config-driven (endpoint + headers, no hardcoded exporter) so it can be swapped without touching code. The existing `LoggerService.telemetryHook` extension point gets wired to emit span events, and a new `TraceContextLoggerDecorator` wraps the configured logger adapter to stamp `traceId`/`spanId` onto every log line — neither mechanism touches any existing adapter file.

**Tech Stack:** NestJS 11, TypeScript (strict), pnpm, Jest, `@opentelemetry/*` (official packages only), Jaeger (`jaegertracing/all-in-one`) via Docker Compose for local development.

## Global Constraints

- Package manager: `pnpm` only — never `npm`/`yarn`.
- TypeScript strict mode: no `any`. Use `unknown` + narrowing instead.
- No third-party NestJS OpenTelemetry wrapper packages (see design spec's "Alternatives considered" — `amplication/opentelemetry-nestjs` and `pragmaticivan/nestjs-otel` were both evaluated and rejected).
- No changes to `src/common/logger/nest-adapter/nest-logger.adapter.ts`, `pino-logger.adapter.ts`, or `winston-logger.adapter.ts`.
- No changes to `src/common/logger/abstract/logger.service.ts` or `logger.interfaces.ts`.
- OTLP exporter protocol is HTTP only (`@opentelemetry/exporter-trace-otlp-http`) —
  the gRPC exporter's config type omits `headers` in favor of a `grpc.Metadata`
  object, discovered while implementing Task 3; switched to avoid adding
  `@grpc/grpc-js` as a direct dependency just to build one. No protocol option
  in this pass.
- No metrics work — `nestjs-prometheus`/Prometheus are untouched.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`) on the current branch (`feat/monitoring`).
- Test files follow the existing `*.unit.spec.ts` convention, colocated next to the source file.
- Design reference: `docs/superpowers/specs/2026-07-16-opentelemetry-integration-design.md`.

---

### Task 1: Install OpenTelemetry dependencies

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml` (generated)

**Interfaces:**
- Consumes: nothing.
- Produces: the following packages available to import in every later task —
  `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/sdk-trace-node`,
  `@opentelemetry/resources`, `@opentelemetry/semantic-conventions`,
  `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/instrumentation-http`,
  `@opentelemetry/instrumentation-nestjs-core`, `@opentelemetry/instrumentation-pg`,
  `@opentelemetry/instrumentation-ioredis` (dependencies); `@opentelemetry/sdk-trace-base`
  (devDependency, test-only).

  > **Amended after Task 3 revealed the gRPC exporter's config type omits
  > `headers`.** Task 1 originally installed `@opentelemetry/exporter-trace-otlp-grpc`;
  > it has since been swapped for `@opentelemetry/exporter-trace-otlp-http`
  > (commit `f24768e`, done at the controller level, not by an implementer
  > subagent). Any resumption of this plan should treat the package list
  > above — with `-http`, not `-grpc` — as current.

- [ ] **Step 1: Install runtime dependencies**

Run:
```bash
pnpm add @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/sdk-trace-node @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/exporter-trace-otlp-http @opentelemetry/instrumentation-http @opentelemetry/instrumentation-nestjs-core @opentelemetry/instrumentation-pg @opentelemetry/instrumentation-ioredis
```

Expected: `package.json` gains the 10 packages under `dependencies`, `pnpm-lock.yaml` updates, command exits 0.

- [ ] **Step 2: Install the test-only dependency**

Run:
```bash
pnpm add -D @opentelemetry/sdk-trace-base
```

Expected: `package.json` gains `@opentelemetry/sdk-trace-base` under `devDependencies`.

- [ ] **Step 3: Verify the build still passes**

Run: `pnpm run build`
Expected: exits 0, no TypeScript errors (nothing references the new packages yet, so this just confirms the install didn't break anything).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add OpenTelemetry dependencies"
```

---

### Task 2: `otel-env.ts` — read and validate OTEL_* environment variables

**Files:**
- Create: `src/tracing/otel-env.ts`
- Test: `src/tracing/otel-env.unit.spec.ts`

**Interfaces:**
- Consumes: `joi` (already a dependency).
- Produces: `export interface OtelConfig { enabled: boolean; serviceName: string; endpoint: string; headers: Record<string, string>; }` and `export function getOtelConfig(env?: NodeJS.ProcessEnv): OtelConfig` — this is what Task 3's `tracing.bootstrap.ts` imports and calls.

- [ ] **Step 1: Write the failing test**

Create `src/tracing/otel-env.unit.spec.ts`:

```typescript
import { getOtelConfig } from './otel-env';

describe('getOtelConfig', () => {
  it('is disabled when OTEL_EXPORTER_OTLP_ENDPOINT is not set', () => {
    const config = getOtelConfig({});

    expect(config).toEqual({
      enabled: false,
      serviceName: '',
      endpoint: '',
      headers: {},
    });
  });

  it('is enabled with defaults when only the endpoint is set', () => {
    const config = getOtelConfig({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4317',
    });

    expect(config).toEqual({
      enabled: true,
      serviceName: 'nestjs-template',
      endpoint: 'http://localhost:4317',
      headers: {},
    });
  });

  it('uses a custom service name when provided', () => {
    const config = getOtelConfig({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4317',
      OTEL_SERVICE_NAME: 'my-api',
    });

    expect(config.serviceName).toBe('my-api');
  });

  it('parses comma-separated key=value headers', () => {
    const config = getOtelConfig({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4317',
      OTEL_EXPORTER_OTLP_HEADERS: 'api-key=abc123,x-custom=val',
    });

    expect(config.headers).toEqual({
      'api-key': 'abc123',
      'x-custom': 'val',
    });
  });

  it('throws when the endpoint is not a valid URI', () => {
    expect(() =>
      getOtelConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: 'not-a-url' }),
    ).toThrow(/Invalid OTEL environment configuration/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest src/tracing/otel-env.unit.spec.ts`
Expected: FAIL — `Cannot find module './otel-env'`.

- [ ] **Step 3: Write the implementation**

Create `src/tracing/otel-env.ts`:

```typescript
import Joi from 'joi';

export interface OtelConfig {
  enabled: boolean;
  serviceName: string;
  endpoint: string;
  headers: Record<string, string>;
}

interface RawOtelEnv {
  endpoint?: string;
  serviceName: string;
  headers?: string;
}

const schema = Joi.object<RawOtelEnv>({
  endpoint: Joi.string().uri().optional(),
  serviceName: Joi.string().default('nestjs-template'),
  headers: Joi.string().optional(),
});

export function getOtelConfig(
  env: NodeJS.ProcessEnv = process.env,
): OtelConfig {
  const raw = {
    endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    serviceName: env.OTEL_SERVICE_NAME,
    headers: env.OTEL_EXPORTER_OTLP_HEADERS,
  };

  const { error, value } = schema.validate(raw, { abortEarly: false });
  if (error) {
    throw new Error(`Invalid OTEL environment configuration: ${error.message}`);
  }

  if (!value.endpoint) {
    return { enabled: false, serviceName: '', endpoint: '', headers: {} };
  }

  return {
    enabled: true,
    serviceName: value.serviceName,
    endpoint: value.endpoint,
    headers: parseHeaders(value.headers),
  };
}

function parseHeaders(raw?: string): Record<string, string> {
  if (!raw) return {};

  const headers: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const [key, val] = pair.split('=');
    if (key?.trim() && val?.trim()) {
      headers[key.trim()] = val.trim();
    }
  }
  return headers;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm jest src/tracing/otel-env.unit.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Lint and commit**

```bash
pnpm run lint
git add src/tracing/otel-env.ts src/tracing/otel-env.unit.spec.ts
git commit -m "feat: add OTEL environment config reader"
```

---

### Task 3: `tracing.bootstrap.ts` — build and start the NodeSDK, wire into `main.ts`

**Files:**
- Create: `src/tracing/tracing.bootstrap.ts`
- Test: `src/tracing/tracing.bootstrap.unit.spec.ts`
- Modify: `src/main.ts:1`

**Interfaces:**
- Consumes: `OtelConfig`, `getOtelConfig` from `./otel-env` (Task 2).
- Produces: `export function buildSdk(config: OtelConfig): NodeSDK | null` (the testable unit); the file's side effect (calling `getOtelConfig()` + `buildSdk()` + `.start()`) runs automatically on import.

- [ ] **Step 1: Write the failing test**

Create `src/tracing/tracing.bootstrap.unit.spec.ts`:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { buildSdk } from './tracing.bootstrap';
import { OtelConfig } from './otel-env';

describe('buildSdk', () => {
  it('returns null when tracing is disabled', () => {
    const config: OtelConfig = {
      enabled: false,
      serviceName: '',
      endpoint: '',
      headers: {},
    };

    expect(buildSdk(config)).toBeNull();
  });

  it('returns a NodeSDK instance when tracing is enabled', () => {
    const config: OtelConfig = {
      enabled: true,
      serviceName: 'test-service',
      endpoint: 'http://localhost:4318',
      headers: {},
    };

    expect(buildSdk(config)).toBeInstanceOf(NodeSDK);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest src/tracing/tracing.bootstrap.unit.spec.ts`
Expected: FAIL — `Cannot find module './tracing.bootstrap'`.

- [ ] **Step 3: Write the implementation**

Create `src/tracing/tracing.bootstrap.ts`:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { getOtelConfig, OtelConfig } from './otel-env';

export function buildSdk(config: OtelConfig): NodeSDK | null {
  if (!config.enabled) return null;

  return new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: config.endpoint,
      headers: config.headers,
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new NestInstrumentation(),
      new PgInstrumentation(),
      new IORedisInstrumentation(),
    ],
  });
}

const sdk = buildSdk(getOtelConfig());

if (sdk) {
  sdk.start();

  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .catch((err: unknown) => {
        console.error('Error shutting down OpenTelemetry SDK', err);
      })
      .finally(() => process.exit(0));
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm jest src/tracing/tracing.bootstrap.unit.spec.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Wire the bootstrap into `main.ts`**

Modify `src/main.ts` — add one line at the very top, before every other import:

```typescript
import './tracing/tracing.bootstrap';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { appScope, AppScopeConfig } from './app.scope';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
```

(Only the first line is new; every other line stays exactly as it is today.)

- [ ] **Step 6: Verify the build still passes**

Run: `pnpm run build`
Expected: exits 0. (`OTEL_EXPORTER_OTLP_ENDPOINT` is not set locally yet, so `buildSdk` returns `null` and nothing tries to connect anywhere — the app is unaffected until Task 7 sets the env var.)

- [ ] **Step 7: Lint and commit**

```bash
pnpm run lint
git add src/tracing/tracing.bootstrap.ts src/tracing/tracing.bootstrap.unit.spec.ts src/main.ts
git commit -m "feat: initialize OpenTelemetry NodeSDK before Nest bootstraps"
```

---

### Task 4: `span.decorator.ts` — the `@Span()` method decorator

**Files:**
- Create: `src/tracing/span.decorator.ts`
- Test: `src/tracing/span.decorator.unit.spec.ts`

**Interfaces:**
- Consumes: `@opentelemetry/api`.
- Produces: `export function Span(name?: string): MethodDecorator` — available for any service method in the codebase to use (not applied to any existing method in this plan; see Global Constraints).

> **Note on the installed SDK version:** `@opentelemetry/sdk-trace-base`/`-node`
> resolved to `2.9.0`, which removed `TracerProvider.addSpanProcessor()` — span
> processors are constructor-only now, via a `spanProcessors: SpanProcessor[]`
> option (confirmed against the installed `.d.ts` after Task 4's first attempt
> hit `provider.addSpanProcessor is not a function`). The test below already
> uses the corrected constructor form.
>
> **Second, independent fix:** `trace.setGlobalTracerProvider()` (called
> internally by `provider.register()`) silently no-ops if a provider is
> already registered globally — confirmed against `@opentelemetry/api`'s
> `TraceAPI.setGlobalTracerProvider` (`returns true if... else false`) and its
> `disable()` method ("Remove the global tracer provider"). Without resetting
> between tests, only the first `it()` block's provider actually takes effect
> and every later test silently records into a shut-down provider, producing
> empty span arrays. The `afterEach` below already calls `trace.disable()` to
> fix this — do not remove it.

- [ ] **Step 1: Write the failing test**

Create `src/tracing/span.decorator.unit.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest src/tracing/span.decorator.unit.spec.ts`
Expected: FAIL — `Cannot find module './span.decorator'`.

- [ ] **Step 3: Write the implementation**

Create `src/tracing/span.decorator.ts`:

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('nestjs-template');

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm jest src/tracing/span.decorator.unit.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Lint and commit**

```bash
pnpm run lint
git add src/tracing/span.decorator.ts src/tracing/span.decorator.unit.spec.ts
git commit -m "feat: add @Span() method decorator for manual tracing"
```

---

### Task 5: `TraceContextLoggerDecorator` — stamp trace context onto every log line

**Files:**
- Create: `src/common/logger/trace-context/trace-context-logger.decorator.ts`
- Test: `src/common/logger/trace-context/trace-context-logger.decorator.unit.spec.ts`

**Interfaces:**
- Consumes: `LoggerService`, `LogInput` from `../abstract/logger.service` and `../abstract/logger.interfaces` (existing, untouched); `trace` from `@opentelemetry/api`.
- Produces: `export class TraceContextLoggerDecorator extends LoggerService` with constructor `(inner: LoggerService)` — this is what Task 6 wires into `app.module.ts`.

> **Note carried over from Task 4:** the test below already includes
> `trace.disable()` in `afterEach`, needed because
> `trace.setGlobalTracerProvider()` no-ops once a provider is registered
> globally — without resetting it, only the first test's provider actually
> takes effect. Do not remove it.

- [ ] **Step 1: Write the failing test**

Create `src/common/logger/trace-context/trace-context-logger.decorator.unit.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm jest src/common/logger/trace-context/trace-context-logger.decorator.unit.spec.ts`
Expected: FAIL — `Cannot find module './trace-context-logger.decorator'`.

- [ ] **Step 3: Write the implementation**

Create `src/common/logger/trace-context/trace-context-logger.decorator.ts`:

```typescript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm jest src/common/logger/trace-context/trace-context-logger.decorator.unit.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Lint and commit**

```bash
pnpm run lint
git add src/common/logger/trace-context/
git commit -m "feat: add TraceContextLoggerDecorator for log/trace correlation"
```

---

### Task 6: Wire tracing into `app.module.ts`

**Files:**
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: `TraceContextLoggerDecorator` (Task 5), `trace` from `@opentelemetry/api`. `LoggerAbstractModule.forRootAsync` and its `telemetryHook` option already exist and are already covered by `logger-abstract.module.unit.spec.ts` — this task only changes how they're *used*, not their behavior, so no new automated test is added here (see Step 3).
- Produces: nothing new for later tasks — this is the last piece of application wiring.

- [ ] **Step 1: Add the two new imports**

In `src/app.module.ts`, add these two imports alongside the existing logger imports (near line 37-39):

```typescript
import { trace } from '@opentelemetry/api';
import { TraceContextLoggerDecorator } from './common/logger/trace-context/trace-context-logger.decorator';
```

- [ ] **Step 2: Replace the `LoggerAbstractModule.forRoot` registration**

Find this block in `src/app.module.ts`:

```typescript
    LoggerAbstractModule.forRoot({
      adapter: NestLoggerAdapter,
      isGlobal: true,
    }),
```

Replace it with:

```typescript
    LoggerAbstractModule.forRootAsync({
      isGlobal: true,
      useFactory: () =>
        new TraceContextLoggerDecorator(new NestLoggerAdapter()),
      telemetryHook: (level, input, context) => {
        trace.getActiveSpan()?.addEvent(input.message, {
          level,
          context,
          ...input.data,
        });
      },
    }),
```

(`NestLoggerAdapter` and `LoggerService` stay imported exactly as they are today — `NestLoggerAdapter` is still used inside the factory, `LoggerService` is still used by the email module's `inject` array further down.)

- [ ] **Step 3: Verify — build, lint, full test suite**

Run: `pnpm run build`
Expected: exits 0.

Run: `pnpm run lint`
Expected: exits 0.

Run: `pnpm test`
Expected: all existing suites still pass — including `logger-abstract.module.unit.spec.ts`, which already exercises `forRootAsync` + `telemetryHook` generically. This task doesn't need its own new spec file: it only changes which concrete `LoggerService` implementation and which factory `app.module.ts` passes into machinery that Tasks 5 and the pre-existing logger tests already cover directly.

- [ ] **Step 4: Commit**

```bash
git add src/app.module.ts
git commit -m "feat: wire TraceContextLoggerDecorator and telemetryHook into AppModule"
```

---

### Task 7: Local Jaeger backend

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: a running OTLP receiver at `http://localhost:4318` (HTTP — see Task 3's amendment) for Task 8's end-to-end verification.

- [ ] **Step 1: Add the Jaeger service to `docker-compose.yml`**

Modify `docker-compose.yml` — add the `jaeger` service alongside the existing `postgres` service:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: local-postgres
    restart: always
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: nestjs-template
    volumes:
      - postgres_data:/var/lib/postgresql/data

  jaeger:
    image: jaegertracing/all-in-one:1.60
    container_name: local-jaeger
    restart: always
    ports:
      - '16686:16686' # UI
      - '4318:4318'   # OTLP HTTP receiver — used by our exporter
      - '4317:4317'   # OTLP gRPC receiver (unused by our exporter, exposed for free)
    environment:
      COLLECTOR_OTLP_ENABLED: 'true'

volumes:
  postgres_data:
```

- [ ] **Step 2: Bring it up and verify**

Run: `docker compose up jaeger -d`
Expected: container starts.

Run: `docker compose ps jaeger`
Expected: state `Up` / `running`.

Run: `curl -sf http://localhost:16686 > /dev/null && echo "Jaeger UI reachable"`
Expected: prints `Jaeger UI reachable`.

- [ ] **Step 3: Document the endpoint in `.env.example`**

Add to `.env.example` (append at the end, with a comment):

```
# OpenTelemetry — leave OTEL_EXPORTER_OTLP_ENDPOINT unset to disable tracing entirely.
# Local dev default points at the Jaeger container from docker-compose.yml.
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_HEADERS=
OTEL_SERVICE_NAME=nestjs-template
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat: add local Jaeger service for OpenTelemetry development"
```

---

### Task 8: End-to-end manual verification

**Files:** none (verification only — no code changes).

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: nothing — this is the proof the whole feature works together.

- [ ] **Step 1: Set the local endpoint**

In your local `.env` (not `.env.example`), set:
```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=nestjs-template
```

- [ ] **Step 2: Bring up dependencies**

Run: `docker compose up -d`
Expected: both `local-postgres` and `local-jaeger` report `Up`.

- [ ] **Step 3: Run database migrations (if not already applied)**

Run: `pnpm run db:migration:run`
Expected: exits 0 (or reports no pending migrations).

- [ ] **Step 4: Start the app**

Run: `pnpm run start:dev`
Expected: app starts on the configured port with no errors, no crash from the tracing bootstrap.

- [ ] **Step 5: Generate a request**

In a separate terminal:
```bash
curl -s http://localhost:5000/api -o /dev/null -w "%{http_code}\n"
```
(Adjust the port if `PORT`/`SELF_URL` differ in your `.env`.) Expected: `200`.

- [ ] **Step 6: Confirm the log line carries trace context**

In the `pnpm run start:dev` terminal output, find a log line emitted during that request and confirm it includes `traceId` and `spanId` fields (exact formatting depends on `NestLoggerAdapter`'s output, but the fields must be present in the structured data).

- [ ] **Step 7: Confirm the trace appears in Jaeger**

Open `http://localhost:16686` in a browser, select service `nestjs-template` in the search panel, click "Find Traces". Expected: at least one trace appears, with an HTTP server span for the request made in Step 5.

- [ ] **Step 8: Confirm log correlation inside the trace**

Click into that trace. Expected: the span (or one of its children) has a "Logs" entry corresponding to the log line from Step 6 — this is the `telemetryHook` → `span.addEvent()` path from Task 6 rendering inside Jaeger's own UI.

- [ ] **Step 9: Confirm graceful shutdown doesn't hang**

Stop the app with `Ctrl+C`. Expected: process exits promptly (the `SIGTERM` handler in `tracing.bootstrap.ts` flushes and exits, it doesn't hang waiting on an unreachable exporter or similar).

If any step fails, do not proceed — go back to the relevant task, fix, and re-verify from Step 4.
