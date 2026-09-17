# Logger — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded),
> `docs/architecture/module-contract.md` and `src/common/CLAUDE.md`. Read those
> first — this file adds only what is specific to `src/common/observability/logger/`.

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
6. `Logger` from `@nestjs/common` is still used directly in
   `src/common/middleware/`, `src/auth/google/google.module.ts` and
   `src/auth/google/google.service.ts`. That is legacy — new code injects
   `LoggerService`.
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
`abstract/` and `nest-adapter/` need only `@nestjs/common`. `pino-adapter/` needs
`pino` (and `pino-pretty` for the dev preset); `winston-adapter/` needs
`winston`. Take `PRACTICES.md` with it — the practices are the valuable half.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`C5`** — `src/auth/google/google.service.ts` logs the raw provider error on
  the token path, against this module's own practices.
- Direct `@nestjs/common` `Logger` use persists in middleware and the Google
  auth module.
