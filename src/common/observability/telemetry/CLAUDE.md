# Telemetry — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded),
> `docs/architecture/module-contract.md` and `src/common/CLAUDE.md`. Read those
> first — this file adds only what is specific to
> `src/common/observability/telemetry/`.

This module does not follow the adapter-module contract in
`docs/architecture/module-contract.md` — there is one backend (OpenTelemetry),
selected by whether `OTEL_EXPORTER_OTLP_ENDPOINT` is set, not a
`forRoot`/`forRootAsync` registration. There is no abstract class to inject;
`@Span()` and the SDK bootstrap are used directly.

## Scope

Owns OpenTelemetry SDK bootstrap, OTel environment config, and the `@Span()`
manual-span decorator. See `README.md` for the full guide on when to reach for
`@Span()`.

Does not own: correlating trace IDs onto log lines, which
`src/common/observability/logger/trace-context/trace-context-logger.decorator.ts`
does by reading the active span this module starts.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `getOtelConfig`, `OtelConfig` | `otel-env.ts` | Reads and validates `OTEL_*` env vars; `enabled: false` when no endpoint is set |
| `buildSdk` | `tracing.bootstrap.ts` | Constructs the `NodeSDK`; the module's side-effecting default export path (`import './...tracing.bootstrap'`) starts it |
| `Span` | `span.decorator.ts` | `@Span()` method decorator — wraps sync and async methods in a span, records thrown errors |

## Rules

1. `src/main.ts`'s first import is
   `./common/observability/telemetry/tracing.bootstrap` — before any other
   import, including `AppModule`. OTel instrumentations patch `http`/`pg`/
   `ioredis` at `require()` time, so the SDK must start before those modules
   load anywhere else in the graph. Do not reorder this import.
2. **`otel-env.ts` reads `process.env` directly — a deliberate, documented
   exception to root invariant T2.** `tracing.bootstrap.ts` runs before
   `NestFactory.create()`, so before the Nest DI container (and
   `ConfigProviderAbstractModule`) exists; a config scope cannot be resolved
   yet. See the comment at the top of `otel-env.ts` before assuming this is a
   violation to fix.
3. Tracing is opt-in via config, not code: leaving
   `OTEL_EXPORTER_OTLP_ENDPOINT` unset makes `buildSdk` return `null` and the
   app runs exactly as it would without this module. A local backend is
   `docker-compose.yml`'s `jaeger` service.
4. `@Span()` decorates a method that is a meaningful business step,
   crosses an uninstrumented IO boundary, or is a branch point worth seeing in
   the waterfall — not every method. See `README.md`'s decision table before
   adding one.
5. `@Span()` ends the span in every exit path — success, thrown sync error,
   and rejected promise — and calls `span.recordException` /
   `setStatus({ code: ERROR })` on failure. A new manual-span helper must
   preserve that (an unterminated span is a permanent leak in the exporter).

## Tests

`otel-env.unit.spec.ts` covers the enabled/disabled toggle and header parsing.
`span.decorator.unit.spec.ts` covers the sync, async-success and
async-rejection paths. `tracing.bootstrap.ts` itself has a
`tracing.bootstrap.unit.spec.ts` exercising `buildSdk` directly — it does not
start a real SDK against a live collector.

## Reuse

Copy `src/common/observability/telemetry/` whole. It needs the
`@opentelemetry/*` dependencies listed in `package.json`
(`sdk-node`, `sdk-trace-base`, `exporter-trace-otlp-http`,
`instrumentation-http`, `instrumentation-nestjs-core`, `instrumentation-pg`,
`instrumentation-ioredis`, `resources`, `semantic-conventions`, `api`). Drop
the instrumentations for infrastructure the target project doesn't use.
`tracing.bootstrap.ts`'s import-order requirement (rule 1) travels with it.

`src/common/observability/telemetry/README.md`'s `## Reuse` is the human
version of this section. Keep the two congruent (`T7`).

## Known gaps

- ~~No automated check enforces that `main.ts`'s first import stays
  `tracing.bootstrap` — a reordering during a future edit would silently
  disable instrumentation patching rather than fail loudly.~~ **Fixed on
  `test/tracing-import-order`:**
  `src/common/observability/telemetry/tracing-import-order.unit.spec.ts` reads
  `src/main.ts` and asserts both the position and the side-effect-only form of
  that import, so a reorder fails `pnpm test` instead of going unnoticed.
