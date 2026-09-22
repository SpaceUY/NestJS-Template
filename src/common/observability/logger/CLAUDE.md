# Logger — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and `src/common/CLAUDE.md`.
> Read those first — this file adds only what is specific to
> `src/common/observability/logger/`.

**`src/common/observability/logger/PRACTICES.md` is binding.** It defines how to write a log
line: structured `LogInput` only, past-tense event names, level by signal,
controllers stay log-free, never log then rethrow, never log a secret. Read it
before adding any log statement anywhere in the codebase.

## Scope

Owns the logging abstraction and its adapters. Consumers depend on the abstract
`LoggerService` and never on a logging library.

Does not own: request/response access logging, which
`src/common/middleware/response.interceptor.ts` does.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `LoggerService` | `src/common/observability/logger/abstract/logger.service.ts` | The contract and the DI token — inject this |
| `LogInput`, `LogTelemetryHook` | `src/common/observability/logger/abstract/logger.interfaces.ts` | Log payload shape; telemetry hook signature |
| `LoggerAbstractModule` | `src/common/observability/logger/abstract/logger-abstract.module.ts` | `forRoot` / `forRootAsync` |
| `NestLoggerAdapter` | `src/common/observability/logger/nest-adapter/nest-logger.adapter.ts` | Default adapter; named in `src/app.module.ts` and in self-defaulting services |
| `PinoLoggerAdapter` | `src/common/observability/logger/pino-adapter/pino-logger.adapter.ts` | Peer dep `pino`; named only in `src/app.module.ts` |
| `WinstonLoggerAdapter` | `src/common/observability/logger/winston-adapter/winston-logger.adapter.ts` | Peer dep `winston`; named only in `src/app.module.ts` |
| `TraceContextLoggerDecorator` | `src/common/observability/logger/trace-context/trace-context-logger.decorator.ts` | Wraps any `LoggerService`, stamping `traceId`/`spanId` from the active OTel span onto `data` before forwarding |

## Rules

1. Inject `LoggerService`. Call `this.logger.setContext(MyService.name)` in the
   constructor — every line then carries the class name.
2. `log(input)` takes a `LogInput` object, never a string. Interpolating values
   into `message` destroys machine-parseability; put them in `data`.
3. `data` carries counts, IDs and flags. Never whole arrays, whole entities,
   tokens, keys or PII.
4. A **reusable** service (an adapter shipped as part of a module) takes
   `logger?: LoggerService` as its last constructor parameter and falls back to
   `new NestLoggerAdapter(...)` when it is absent. That keeps the module usable
   without `LoggerAbstractModule` registered — `ResendAdapterService` is the
   reference. An **application** service simply injects `LoggerService`.
5. `telemetryHook` on `forRoot`/`forRootAsync` is the single integration point
   for OpenTelemetry or Datadog. A throwing hook must never break the caller;
   `LoggerService.emitTelemetry` already guarantees that.
6. **Optional injection is the shape for a class that is both wired by the
   container and copied elsewhere.** `@Optional() @Inject(LoggerService)` with
   a `new NestLoggerAdapter(...)` fallback gets the container's logger — trace
   id, telemetry hook — when one is registered, and still boots in a project
   that copied the file without `LoggerAbstractModule`. Rule 4's constructor
   parameter is the same idea for an adapter that is constructed with `new`
   rather than resolved. `src/common/middleware/response.interceptor.ts` is the
   reference.

   No file outside this module builds a `@nestjs/common` `Logger`, and none
   calls `console` for application logging either. The two `Logger` calls that
   legitimately remain are `nest-adapter/nest-logger.adapter.ts`, which is the
   adapter, and `src/cache/redis-adapter/redis-adapter.service.ts`, which adapts
   one into its own `StandardLogger` precisely so that `cache` keeps zero
   cross-module imports. The two `console.error` calls that remain are
   `abstract/logger.service.ts` — the telemetry-hook fallback, which cannot log
   through the logger it is reporting about — and
   `src/common/observability/telemetry/tracing.bootstrap.ts`, which runs before
   the DI container exists.
7. `TraceContextLoggerDecorator` wraps an inner `LoggerService` — it is the
   `useFactory` result in `src/app.module.ts`, not a registered adapter class.
   Any new decorator follows the same shape: implement `LoggerService`, take
   the wrapped instance as a constructor argument, and call `emitTelemetry`
   itself after forwarding (decorators sit outside the adapter the hook was
   designed around).

## Adding an adapter

1. Create `src/common/observability/logger/<name>-adapter/<name>-logger.adapter.ts` extending
   `LoggerService`.
2. Implement `setContext`, `log`, `warn`, `error`, `debug`.
3. End each level method with `this.emitTelemetry(level, input, context)` so the
   hook fires without the adapter knowing anything about telemetry.
4. Declare the logging library as a peer dependency; do not add it to
   `dependencies`.
5. Add `<name>-logger.adapter.unit.spec.ts` alongside.

## Tests

This is the best-tested module in the template — six `*.unit.spec.ts` files
covering the abstract module, the serializer, all three adapters and the
trace-context decorator. Follow
`src/common/observability/logger/nest-adapter/nest-logger.adapter.unit.spec.ts`: construct the
adapter directly, spy on the underlying library, assert the emitted shape.
`src/common/observability/logger/abstract/serialize-error.unit.spec.ts` covers circular
references and must keep passing.
`src/common/observability/logger/trace-context/trace-context-logger.decorator.unit.spec.ts`
asserts trace/span stamping with and without an active span, by constructing
the decorator directly around a mock `LoggerService`.

## Reuse

Copy `src/common/observability/logger/` whole, minus the adapter directories you do not want.
`abstract/` needs `@nestjs/common` and `class-transformer` (`logger-abstract.module.ts`
imports `ClassConstructor` from it); `nest-adapter/` needs only `@nestjs/common`.
`pino-adapter/` needs `pino` (and `pino-pretty` for the dev preset);
`winston-adapter/` needs `winston`. Take `PRACTICES.md` with it — the
practices are the valuable half.

`src/common/observability/logger/README.md`'s `## Reuse` is the human version
of this section. Keep the two congruent (`T7`).

## Known gaps

**This module ships no error type.** A logging failure surfaces as whatever the
underlying transport throws. In practice that is invisible — the adapters do not
throw on a write — but it means there is nothing to catch specifically, and a
consumer cannot tell a logger failure from any other.

**It ships no test doubles.** A consumer asserting on log output hand-rolls a
fake against `LoggerService`; the abstract class is small enough that a
`jest.fn()` per method is usually all it takes. `src/cache/abstract/mocks/` is
the shape to copy if you add them.

**Two `new Logger(...)` calls remain in `src/` by design:** the
`NestLoggerAdapter` itself, and the Redis cache adapter, which keeps its own so
that `src/cache/` lifts with zero companion directories.
