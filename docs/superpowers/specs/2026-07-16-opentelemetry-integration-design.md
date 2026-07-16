# OpenTelemetry Integration — Design

**Date:** 2026-07-16
**Status:** Approved for planning

## Context

The project currently has no distributed tracing. Backend observability strategy
(evaluated separately) concluded the stack should stay on Grafana + PostHog, but
adopt OpenTelemetry now as a vendor-neutral instrumentation layer, so the trace
backend (Jaeger today, potentially Grafana Alloy/Tempo or another OTLP-compatible
backend later) can change without touching application code.

The logger module (`src/common/logger/`) already anticipated this: `LoggerService`
exposes a `telemetryHook` extension point, documented in
`src/common/logger/README.md` under "Telemetry Hook (future integration point)",
specifically for wiring a tracing span event without touching any adapter
(Nest/Pino/Winston).

## Goals

- Add distributed tracing to the NestJS backend using only official
  `@opentelemetry/*` packages (no third-party NestJS wrapper packages — evaluated
  and rejected `amplication/opentelemetry-nestjs`: last release March 2024, fork
  of a fork, low activity) plus one small first-party decorator for manual spans
  (no official package offers this for any framework — it's out of scope for the
  OTel project by design).
- Keep the trace backend fully swappable via configuration (endpoint + headers),
  never hardcoded — OTLP is already the vendor-neutral protocol, so no
  adapter-class abstraction is needed here (unlike logger/cache/email, where the
  underlying libraries have genuinely different APIs).
- Give local development a working, self-contained way to see traces without
  depending on any hosted backend.
- Connect the existing `telemetryHook` so log lines appear as span events on the
  active trace, with zero changes to any logger adapter.

## Non-goals (explicitly out of scope for this pass)

- No changes to any logger adapter (Nest/Pino/Winston) and no
  `@opentelemetry/instrumentation-winston` / `-pino` — log-to-trace correlation
  goes through the existing `telemetryHook` → `span.addEvent()`, not by injecting
  `trace_id`/`span_id` into the raw JSON log line.
- No retrofitting of `@Span()` onto any existing service method — the decorator
  ships ready to use; adoption is a separate, later effort.
- No metrics work — `nestjs-prometheus`/Prometheus stay exactly as they are.
- No OTLP protocol option (HTTP vs gRPC) — gRPC only, matching Jaeger's default
  receiver port. Revisit only if a future backend specifically needs HTTP.

## Architecture

```
main.ts
  └─ import './tracing/tracing.bootstrap'   ← first line, before ANY other import
       └─ reads OTEL_* from process.env (otel-env.ts — no Nest DI available yet,
          this runs before the Nest module graph exists)
       └─ no endpoint configured → no-op, app boots exactly as today
       └─ endpoint configured → NodeSDK + OTLPTraceExporter (gRPC) + explicit
          official instrumentations: Http, Nest, Pg, IORedis
  └─ import { AppModule } ...               ← only now does pg/ioredis/etc get
                                                required — already patched

app.module.ts
  └─ LoggerAbstractModule.forRoot({
       adapter: NestLoggerAdapter,
       isGlobal: true,
       telemetryHook: (level, input, context) => {
         trace.getActiveSpan()?.addEvent(input.message, { level, context, ...input.data });
       },
     })

docker-compose.yml
  └─ + jaeger service (jaegertracing/all-in-one) — UI on :16686, OTLP receiver on
       :4317 (gRPC) / :4318 (HTTP, unused by our exporter but exposed for free)
```

**Why `otel-env.ts` doesn't use `defineConfigScope`/`ConfigProviderAbstractModule`:**
that system resolves values through Nest DI at module-registration time. The
tracing bootstrap file must run *before* `NestFactory.create()` — before the Nest
module graph, and therefore before that DI container, exists. It reads
`process.env` directly with its own small Joi validation, deliberately mirroring
the style of a `*.scope.ts` file without depending on the DI-based resolution
machinery. This is the one place in the codebase that reads env vars directly
instead of through the config-provider abstraction, and it's called out here so
it doesn't read as an inconsistency later.

## Components / files

**New — `src/tracing/`:**

- `otel-env.ts` — reads and validates `OTEL_EXPORTER_OTLP_ENDPOINT` (optional;
  absent ⇒ tracing disabled), `OTEL_EXPORTER_OTLP_HEADERS` (optional, `key=value`
  comma-separated, for backends that require auth like Grafana Cloud),
  `OTEL_SERVICE_NAME` (optional, defaults to `nestjs-template`). Returns a typed
  result indicating whether tracing is enabled.
- `tracing.bootstrap.ts` — builds and starts a `NodeSDK` when tracing is enabled:
  `Resource` with `service.name` / `deployment.environment`, `OTLPTraceExporter`
  (gRPC, endpoint + headers from `otel-env.ts`), instrumentations array
  (`HttpInstrumentation`, `NestInstrumentation`, `PgInstrumentation`,
  `IORedisInstrumentation` — all official, imported by name, not via the
  `auto-instrumentations-node` meta-bundle). Registers a `SIGTERM` handler that
  flushes/shuts down the SDK.
- `span.decorator.ts` — exports `Span(name?: string): MethodDecorator`. Wraps the
  original method in `tracer.startActiveSpan(...)`, supports both sync and async
  methods, calls `span.recordException()` + sets `SpanStatusCode.ERROR` on throw,
  always ends the span, re-throws the original error. Depends only on
  `@opentelemetry/api`.
- `otel-env.unit.spec.ts`, `span.decorator.unit.spec.ts` — unit tests, following
  the project's existing `*.unit.spec.ts` convention (see `logger/abstract/`).

**Modified:**

- `src/main.ts` — add `import './tracing/tracing.bootstrap';` as the first line.
- `src/app.module.ts` — add the `telemetryHook` to the existing
  `LoggerAbstractModule.forRoot(...)` call.
- `.env.example` — add commented `OTEL_EXPORTER_OTLP_ENDPOINT` (defaulted in the
  comment to `http://localhost:4317`, matching the new Jaeger service),
  `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME`.
- `docker-compose.yml` — add the `jaeger` service.
- `package.json` — new dependencies (added via `pnpm add`, not hand-edited):
  `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/sdk-trace-node`,
  `@opentelemetry/resources`, `@opentelemetry/semantic-conventions`,
  `@opentelemetry/exporter-trace-otlp-grpc`, `@opentelemetry/instrumentation-http`,
  `@opentelemetry/instrumentation-nestjs-core`, `@opentelemetry/instrumentation-pg`,
  `@opentelemetry/instrumentation-ioredis`.

## Error handling

- No endpoint configured → `tracing.bootstrap.ts` returns early; SDK is never
  constructed. App behavior is identical to today.
- Endpoint configured but unreachable (e.g., Jaeger container not running) → the
  exporter fails in the background per standard OTel SDK behavior (internal
  diagnostic logging, not thrown into application code). The app keeps running;
  traces simply don't show up.
- `LoggerService.emitTelemetry` already wraps the hook call in try/catch
  (pre-existing code) — a throwing `telemetryHook` cannot break a log call. No
  changes needed there.

## Testing

- `otel-env.unit.spec.ts`: endpoint present/absent, header parsing, service name
  default.
- `span.decorator.unit.spec.ts`: wraps sync and async methods, ends the span on
  success, records exception + sets error status + re-throws on failure.
- No e2e test requiring a live OTLP collector — out of scope.

## Alternatives considered

1. **`amplication/opentelemetry-nestjs`** (community NestJS wrapper). Rejected:
   last release March 2024, fork of a fork (MetinSeylan → overbit → amplication),
   43 stars — the same abandonment pattern that made the original package stale.
2. **`pragmaticivan/nestjs-otel`** (community NestJS wrapper). More actively
   maintained (release June 2026) and built on official packages, but still a
   third-party dependency for something we can implement directly in ~20 lines
   using only `@opentelemetry/api`. Rejected in favor of owning the decorator.
3. **`@opentelemetry/auto-instrumentations-node` meta-bundle** instead of naming
   instrumentations explicitly. Rejected: pulls in ~50 instrumentations for
   libraries not in this project (Kafka, Cassandra, GraphQL, Mongoose, etc.),
   making it unclear from the code which instrumentations are actually active.
4. **Injecting `trace_id`/`span_id` into the logger's own JSON output** (would
   need adapter changes). Rejected in favor of the already-designed
   `telemetryHook` → `span.addEvent()` path, which requires zero adapter changes
   and was explicitly anticipated by the existing logger README.
