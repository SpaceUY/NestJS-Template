# Common — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/common/`.

## Scope

Cross-cutting primitives with no domain of their own: the HTTP exception
vocabulary, the global response interceptor and exception filter, shared
decorators, and the dynamic-module validation helper.
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

## Internal

`ApiException` was deleted from `src/common/exception/` on
`chore/dead-code-and-error-model`. It was a plain `Error` with no HTTP status,
and its only callers — three validation throws in the cloud-storage default
controller — answered `500` where `400` was intended. They now throw
`BadRequestException`. If you need a new error shape here, it is one of the two
in Rule 1, not a third.

`ERROR_CODES`/`ErrorCode` went with it. `!src/common/enums.ts` was a generic
code list whose only consumer was that same `ApiException` path (finding `H2`).
Error codes belong to the module that raises them — `EMAIL_ERRORS`,
`CACHE_ERRORS` and siblings — or to an `Exceptions` entry.

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

Two exceptions boot a real Nest app on purpose, because what they assert is the
wiring rather than the unit: `middleware.module.unit.spec.ts` proves
`MiddlewareModule` actually binds the interceptor and the filter as
`APP_INTERCEPTOR`/`APP_FILTER` (and that a 500 carries no internal detail), and
`decorators/html-content-type.unit.spec.ts` proves `@Html()` sets the header on
the decorated handler only.

## Reuse

`src/common/exception/`, `src/common/utils/` and `src/common/decorators/` are
self-contained — copy the files you need, they depend only on `@nestjs/common`.

`src/common/middleware/` is opinionated about response shape. Copy it only if the
target project wants the `{ success, data }` envelope; otherwise take the filter
and leave the interceptor. The interceptor also needs `rxjs`, plus a real
non-import dependency: `src/common/middleware/response.interceptor.ts:40`
(`user.id`) only type-checks because of the ambient global type augmentation
the repo root ships in `@types/express/index.d.ts`, loaded solely because
`tsconfig.json` sets `"typeRoots": ["@types", "./node_modules/@types"]`. No
import statement references it. Copying the interceptor without also copying
the root `@types/` directory and adding that `typeRoots` entry to the
destination project's `tsconfig.json` leaves it failing to compile (`EXT7`).

## Known gaps

See `docs/audit/2026-09-11-template-audit.md` and `docs/audit/2026-09-18-modularity-audit.md`.

- **`N2`** — ~~four competing error models across the template.~~ **Fixed on
  `chore/dead-code-and-error-model`:** two remain, and they are the two Rule 1
  describes — a module error (`CacheError`, `PushNotificationError`, …) for
  infrastructure, and `RequestException` for the HTTP layer.
  `PushNotificationException` and `ApiException` are both gone.
- **`C4`** — ~~the filter spreads `exception.getResponse()` into the body and
  catches only `HttpException`.~~ **Fixed on `fix/security-defaults`:**
  `@Catch()` with a body built field by field, covered by
  `request-exception.filter.unit.spec.ts`.
- **`H2`** — ~~`ERROR_CODES`/`ErrorCode` have no consumers left after `N2`
  collapsed the error models.~~ **Fixed on `chore/module-gaps`:**
  `!src/common/enums.ts` is deleted along with its public-surface row.
- **`G1`** — ~~`RequestExceptionFilter` is covered; the rest of the middleware,
  the utils and the decorators are not.~~ **Fixed on
  `test/coverage-cache-common`:** `ResponseInterceptor`, `validateAdapterModule`,
  `@Html()` and `MiddlewareModule`'s own wiring all have specs now.
