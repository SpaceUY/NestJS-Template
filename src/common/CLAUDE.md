# Common — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded). Read it first — this file
> adds only what is specific to `src/common/`.

## Scope

Cross-cutting primitives with no domain of their own: the HTTP exception
vocabulary, the global response interceptor and exception filter, the global
rate-limit guard, shared decorators, and the dynamic-module validation helper.
`src/common/observability/` groups the logging and tracing
modules — `logger/` and `telemetry/` are each a full module in
their own right and each has its own guide.

Does not own: anything business-specific, and anything a single module could own
instead. A helper used by exactly one module belongs in that module.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `RequestException`, `ExceptionInfo` | `src/common/exception/core/ExceptionBase.ts` | HTTP exception carrying an `errorCode` |
| `Exceptions` | `src/common/exception/exceptions.ts` | Central registry of `ExceptionInfo` values |
| `MiddlewareModule` | `src/common/middleware/middleware.module.ts` | Registers the global interceptor and filter; imported by `src/app.module.ts` |
| `validateAdapterModule`, `AdapterModuleLike` | `src/common/utils/nest-module-validation.ts` | Fail-fast guard for `forRoot` adapter arguments |
| `Html` | `src/common/decorators/html-content-type.ts` | Sets `Content-Type: text/html` on a handler |
| `RateLimitModule` | `src/common/rate-limit/rate-limit.module.ts` | Binds `ThrottlerGuard` as `APP_GUARD`; imported by `src/app.module.ts` |
| `skipUnthrottledPath`, `UNTHROTTLED_PATH_PREFIXES` | `src/common/rate-limit/rate-limit-skip.util.ts` | The throttler's `skipIf`, and the prefixes it exempts |

## Internal

There is no `ApiException` here, and none may be added. A plain `Error`
carrying no HTTP status answers `500` wherever it surfaces, which is how
validation failures end up as server errors. Throw Nest's own
`BadRequestException` for a bad request, or a `RequestException` built from an
`Exceptions` entry. If you need a new error shape, it is one of the two in
Rule 1, not a third.

There is no generic `ERROR_CODES` enum here, and none may be added. Error codes
belong to the module that raises them — `EMAIL_ERRORS`, `CACHE_ERRORS` and
siblings — or to an `Exceptions` entry. A shared code list in `common` outlives
every module that used it and drifts into a dumping ground.

## Rules

1. **Two error layers, and they do not mix.** A *module* error
   (`CacheError`, `EmailError`, `CloudStorageError`, `ConfigProviderError`,
   `PushNotificationError`, `QueueProducerError`/`QueueConsumerError`) is a
   plain `Error` subclass with `code`, `message` and optional `data` — it carries
   no HTTP semantics, because the module has no idea it is behind HTTP. An
   *HTTP* error is `RequestException`, constructed from an `ExceptionInfo` in the
   `Exceptions` registry, and only application and domain code throws it.
2. Adding an HTTP error means adding an entry to `Exceptions` — a static object
   for a fixed message, or a function of parameters for a dynamic one (see
   `Exceptions.database.alreadyExists`). Do not construct `HttpException`
   directly and do not invent a parallel registry.
3. The global `ResponseInterceptor` wraps every successful response as
   `{ success: true, data }`, except when the handler already returned a `data`
   key or the response is `text/html`. Handlers return plain values and must not
   wrap themselves.
4. `RequestExceptionFilter` is `@Catch()` — everything reaches it, so no
   failure answers with a body shaped differently from the rest. A module
   error that arrives unmapped still answers `500`: catch it in the service
   and rethrow a `RequestException` with the status you mean.
5. A response body must never carry internal detail — no stack, no provider
   message, no SQL. The filter enforces this by building the body field by
   field (`success`, `statusCode`, `message`) and reading only `message` out
   of the exception's payload; it never spreads it.
6. `validateAdapterModule(adapter, 'XModule.forRoot')` goes at the top of any
   `forRoot` that accepts an adapter *module*. Style-A modules that accept an
   adapter *class* do not need it.
7. Nothing in `src/common/` may import from a feature module. The dependency
   arrow points one way.

## Tests

Every file under `src/common/` that holds behaviour has a spec. New work here
ships `*.unit.spec.ts` alongside. `validateAdapterModule` is a pure function —
its spec covers the four accepted shapes and the throwing case directly.
`ResponseInterceptor` and `RequestExceptionFilter` are tested by constructing a
fake `ArgumentsHost` / `ExecutionContext`, not by booting the app.

Three exceptions boot a real Nest app on purpose, because what they assert is
the wiring rather than the unit: `middleware.module.unit.spec.ts` proves
`MiddlewareModule` actually binds the interceptor and the filter as
`APP_INTERCEPTOR`/`APP_FILTER` (and that a 500 carries no internal detail),
`decorators/html-content-type.unit.spec.ts` proves `@Html()` sets the header on
the decorated handler only, and `rate-limit/rate-limit.module.unit.spec.ts`
drives a real app until a route 429s while the exempt probe paths keep
answering 200 well past the limit.

That last one mounts stand-in controllers at `/health` and `/health/live`
rather than importing `HealthController`: `src/common/` must not depend on a
feature module, and the assertion is about the guard's path matching, not
about health. `rate-limit/rate-limit-skip.util.unit.spec.ts` covers the pure
function, including that `/healthcheck-admin` is *not* exempt and that a
non-HTTP context is not either.

That first spec boots twice, which is the point: once with no
`LoggerAbstractModule` — the state a project copying `src/common/middleware/`
alone lands in, where the `@Optional()` injection has to resolve to nothing
without failing the container — and once with one registered, asserting both
classes log through *that* instance rather than their fallback adapter.

## Reuse

`src/common/exception/`, `src/common/utils/` and `src/common/decorators/` are
self-contained — copy the files you need, they depend only on `@nestjs/common`.

`src/common/middleware/` is opinionated about response shape. Copy it only if the
target project wants the `{ success, data }` envelope; otherwise take the filter
and leave the interceptor. Both classes reference
`src/common/observability/logger/` — through `@Optional()` injection, so they
boot without it, but the import has to resolve; bring that subtree or replace
the two constructors. The interceptor also needs `rxjs`, plus a real
non-import dependency: `src/common/middleware/response.interceptor.ts:54`
(`user.id`) only type-checks because of the ambient global type augmentation
the repo root ships in `@types/express/index.d.ts`. No import statement
references it; it applies because `tsconfig.json` declares no `include`, so
every `.d.ts` under the project root is part of the program. Copy the root
`@types/` directory into the destination and make sure its `tsconfig.json`
actually compiles that path — a destination with `"include": ["src"]` will
not, and the file has to move under `src/` there. Without it the interceptor
fails to compile, and no error message names the missing declaration.

Was `typeRoots`; it is not any more. Under TypeScript 6 a `typeRoots` entry no
longer pulls `@types/*` packages in automatically, so this repo names them in
`"types": ["node", "jest"]` instead, and the local augmentation is picked up
as an ordinary source file. Both facts matter to a destination on TypeScript 6:
if it sets `types`, whatever it leaves out of that list stops being loaded.

`src/common/README.md`'s `## Reuse` is the human version of this section. Keep
the two congruent (`T7`).

## Known gaps

**This module has a dependency no import statement names.**
`src/common/middleware/response.interceptor.ts` reads `user.id`, which
type-checks only because the repo root ships `@types/express/index.d.ts` and
this repo's `tsconfig.json` declares no `include`, so every `.d.ts` under the
project root is part of the program. Lifting `src/common/` means copying that
`@types/` directory *and* landing it somewhere the destination's `tsconfig.json`
actually covers — under `"include": ["src"]` it does not. Nothing will point at
this when it breaks: the compiler reports the interceptor, not the missing
ambient type. `## Reuse` below repeats it, because it is the one thing a reader
of that section cannot discover from the source.

**A green `modularity:check` does not prove this module extracts cleanly.** The
checker reads import specifiers; the coupling above has none.
