# Telemetry Module

OpenTelemetry instrumentation: SDK bootstrap, config, and the `@Span()`
decorator for manual spans.

---

## Files

```
src/common/observability/telemetry/
├── otel-env.ts              ← reads/validates OTEL_* environment variables
├── tracing.bootstrap.ts     ← builds and starts the NodeSDK (imported first in main.ts)
└── span.decorator.ts        ← @Span() — manual span decorator
```

---

## `@Span()` — when to use it

Most of the request/DB/cache surface is already traced automatically —
`@Span()` exists only for the parts auto-instrumentation can't see. Adding it
where it isn't needed just adds noise to the waterfall without adding
information.

### Already covered automatically — don't add `@Span()` for this

| Covered by | Signal |
|---|---|
| `HttpInstrumentation` | HTTP requests in/out |
| `NestInstrumentation` | Controllers, guards, pipes, interceptors |
| `PgInstrumentation` | Postgres / TypeORM queries |
| `IORedisInstrumentation` | Redis commands |

If a method only calls into one of these, it already has its own span. Wrapping
it in `@Span()` too just duplicates the name in the trace without adding data.

### Add `@Span()` to a service method when at least one of these is true

1. **It crosses a process/IO boundary auto-instrumentation doesn't cover** —
   a call to an external service with no official instrumentation, a queue
   publish, a file operation.
2. **It's a distinct business step worth timing on its own** — e.g.
   `DiscountService.calculateTier()` does no IO, but "how long tier
   calculation took" is real debugging signal.
3. **It's a place where you'll attach attributes only known there** — e.g.
   `discount.tier`, `payment.provider`, `order.itemCount`. Even if the method
   is instant, the attribute is the payload — not the duration.
4. **It's a branch point you actually debug in practice** — somewhere you'd
   ask "which path did this request take?".

### Don't add `@Span()`

- Pure functions / private helpers with no IO and no decision-relevant state.
- Trivial getters, mappers, DTO transforms.
- Anything called inside a tight loop — span the loop once with a count
  attribute (`items.count`), not one span per iteration.
- A method that only delegates to another method that already has `@Span()`
  or is already covered by an automatic instrumentation above — don't wrap
  the same boundary twice.
- Controller methods — `NestInstrumentation` already spans the request
  handler; put `@Span()` on the service method it calls into instead.

### Mental model

The rule isn't "method = span". It's: **a method that represents a
meaningful business step = span, and the attributes you attach there are the
actual debugging payload.** Duration tells you where the time went;
attributes tell you why — and that "why" is usually only known inside that
specific method.

### Example

```typescript
@Injectable()
export class DiscountService {
  @Span()
  calculateTier(userId: string): DiscountTier {
    const tier = /* ... */;
    trace.getActiveSpan()?.setAttribute('discount.tier', tier);
    return tier;
  }
}
```

`@Span()` with no argument names the span `ClassName.methodName` automatically
(`DiscountService.calculateTier` above). Pass a custom name
(`@Span('CustomName')`) only when the automatic one isn't clear enough in the
waterfall.

---

## `otel-env.ts` / `tracing.bootstrap.ts`

Tracing is fully config-driven and off by default. If
`OTEL_EXPORTER_OTLP_ENDPOINT` isn't set, `tracing.bootstrap.ts` never builds or
starts the SDK — the app behaves exactly as it would without OpenTelemetry.
Set `OTEL_EXPORTER_OTLP_ENDPOINT` (and `OTEL_EXPORTER_OTLP_HEADERS` for
backends that require auth) to enable it; no code changes needed to point at a
different backend.

## Reuse

**Two supported workflows.** Clone the template whole, or lift only the modules
you need — this one is written for both. What follows is the second case: what
`src/common/observability/telemetry/` needs in order to compile in another project.

**What travels with it.** Nothing from another module — the directory imports
only `@nestjs/common` and the OpenTelemetry packages. `src/main.ts` imports
`tracing.bootstrap.ts` first, before anything else, and that import order is a
requirement of the module, not a style choice: the SDK has to start before the
instrumented libraries are loaded. Carry that requirement with the files.

**Peer dependencies.** The `@opentelemetry/*` set listed in `package.json`:
`sdk-node`, `sdk-trace-base`, `exporter-trace-otlp-http`,
`instrumentation-http`, `instrumentation-nestjs-core`, `instrumentation-pg`,
`instrumentation-ioredis`, `resources`, `semantic-conventions` and `api`. Drop
the instrumentations for infrastructure the target project does not run.

**Removing it from the template instead.** Two edits: the
`tracing.bootstrap.ts` import at the top of `src/main.ts` and the `OTEL_*` keys
in `.env.example`.
