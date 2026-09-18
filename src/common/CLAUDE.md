# Common — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/common/`.

## Scope

Cross-cutting primitives with no domain of their own: the HTTP exception
vocabulary, the global response interceptor and exception filter, shared
decorators, and the dynamic-module validation helper.
`src/common/observability/` groups the logging, analytics and tracing
modules — `logger/`, `analytics/` and `telemetry/` are each a full module in
their own right and each has its own guide.

Does not own: anything business-specific, and anything a single module could own
instead. A helper used by exactly one module belongs in that module.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `RequestException`, `ExceptionInfo` | `src/common/exception/core/ExceptionBase.ts` | HTTP exception carrying an `errorCode` |
| `Exceptions` | `src/common/exception/exceptions.ts` | Central registry of `ExceptionInfo` values |
| `ERROR_CODES`, `ErrorCode` | `src/common/enums.ts` | Generic error-code constants |
| `MiddlewareModule` | `src/common/middleware/middleware.module.ts` | Registers the global interceptor and filter; imported by `src/app.module.ts` |
| `validateAdapterModule`, `AdapterModuleLike` | `src/common/utils/nest-module-validation.ts` | Fail-fast guard for `forRoot` adapter arguments |
| `Html` | `src/common/decorators/html-content-type.ts` | Sets `Content-Type: text/html` on a handler |

## Internal

`src/common/exception/api.exception.ts` (`ApiException`) is a plain `Error` and
carries no HTTP status. Its only callers are three throws in the cloud-storage
default controller (`src/cloud-storage/abstract/cloud-storage.controller.ts:43`,
`:58`, `:73`), and since `RequestExceptionFilter` catches only `HttpException`,
every one of them escapes the filter and becomes an unhandled `500` where a `400`
was intended (findings `N2`, `C4`). Do not import it and do not add callers —
throw `RequestException` instead.

## Rules

1. **Two error layers, and they do not mix.** A *module* error
   (`CacheError`, `EmailError`, `CloudStorageError`, `ConfigProviderError`) is a
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
4. `RequestExceptionFilter` only catches `HttpException`. Module errors reaching
   the controller layer are currently unmapped (finding `C4`) — catch them in the
   service and rethrow a `RequestException`.
5. A response body must never carry internal detail — no stack, no provider
   message, no SQL. Finding `C4` records where the filter is loose about this.
6. `validateAdapterModule(adapter, 'XModule.forRoot')` goes at the top of any
   `forRoot` that accepts an adapter *module*. Style-A modules that accept an
   adapter *class* do not need it.
7. Nothing in `src/common/` may import from a feature module. The dependency
   arrow points one way.

## Tests

Nothing under `src/common/` outside `logger/` has a test (finding `G1`). New
work here ships `*.unit.spec.ts` alongside. `validateAdapterModule` is a pure
function — test the four accepted shapes and the throwing case directly.
`ResponseInterceptor` and `RequestExceptionFilter` are tested by constructing a
fake `ArgumentsHost` / `ExecutionContext`, not by booting the app.

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

- **`N2`** — four competing error models across the template, and `ApiException`'s
  three callers in the cloud-storage default controller escape the global filter
  as `500`s.
- **`C4`** — the filter spreads `exception.getResponse()` into the body and
  catches only `HttpException`.
- **`G1`** — no tests for the middleware, the utils or the decorators.
