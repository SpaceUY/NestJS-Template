# Analytics — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded),
> `docs/architecture/module-contract.md` and `src/common/CLAUDE.md`. Read those
> first — this file adds only what is specific to
> `src/analytics/`.

## Scope

Owns provider-agnostic event capture and feature-flag checks. Consumers depend
on the abstract `AnalyticsService` and never on `posthog-node`.

Does not own: tracing/spans (`src/common/observability/telemetry/`) or log
output (`src/common/observability/logger/`). A captured event is a product
signal, not a debugging one — do not use `capture()` in place of a log line.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `AnalyticsService` | `abstract/analytics.service.ts` | The contract and the DI token — inject this |
| `CaptureEventInput` | `abstract/analytics.interfaces.ts` | Shape of the `capture()` payload |
| `AnalyticsAbstractModule` | `abstract/analytics-abstract.module.ts` | `forRoot` / `forRootAsync` |
| `ConsoleAdapterService` | `console-adapter/console-adapter.service.ts` | No-op default; logs instead of sending, `isFeatureEnabled`/`getFeatureFlag` always resolve falsy |
| `PosthogAdapterService` | `posthog-adapter/posthog-adapter.service.ts` | Real adapter; named only in `src/app.module.ts` |
| `analyticsScope`, `AnalyticsScopeConfig`, `ANALYTICS_ADAPTERS` | `config/analytics.scope.ts` | Config scope (T2) — `ANALYTICS_ADAPTER`, `POSTHOG_API_KEY`, `POSTHOG_HOST` |

## Rules

1. Inject `AnalyticsService`, never `PosthogAdapterService` or
   `ConsoleAdapterService` directly (T1).
2. `capture()` is synchronous and fire-and-forget by design — `PosthogAdapterService`
   catches and logs its own client errors rather than propagating them.
   Callers never `await` or try/catch a `capture()` call.
3. `ANALYTICS_ADAPTER=POSTHOG` with an empty `POSTHOG_API_KEY` fails Joi
   validation at boot (`config/analytics.scope.ts`), not at first use.
4. A **reusable** adapter takes `logger?: LoggerService` as its last
   constructor parameter and falls back to `new NestLoggerAdapter(...)` when
   absent, the same convention as
   `src/common/observability/logger/CLAUDE.md` rule 4 —
   `PosthogAdapterService` and `ConsoleAdapterService` both follow it.
5. `PosthogAdapterService` implements `OnModuleDestroy` to await
   `client.shutdown()` so buffered events flush before the process exits. A
   new stateful adapter that buffers or batches needs the same hook.

## Tests

`abstract/analytics-abstract.module.unit.spec.ts` covers `forRoot` /
`forRootAsync` wiring. Both adapters have their own spec, constructed with
`new` and with the provider SDK mocked at module level rather than booting
Nest:

- `console-adapter/console-adapter.service.unit.spec.ts` — the event is logged
  and said to be unsent, both flag methods resolve falsy, and the logger
  fallback of rule 4 holds.
- `posthog-adapter/posthog-adapter.service.unit.spec.ts` — the client is built
  from the config, `capture()` swallows a client failure instead of surfacing
  it (rule 2), an unknown flag reads as `false` rather than `undefined`,
  `onModuleDestroy` actually awaits the flush (rule 5), and the API key never
  reaches a log line.

A new adapter test follows the same shape.

## Reuse

Copy `src/analytics/` whole. `abstract/` and
`console-adapter/` need only `@nestjs/common`; `posthog-adapter/` needs the
peer dependency `posthog-node`. It depends on
`src/config-provider/abstract/` for the scope helpers and, in the adapters,
on `src/common/observability/logger/` for the optional logger fallback — port
those too, or replace the `logger?:` parameter with a different default.

## Known gaps

- **`G1`** — ~~no adapter-level tests for `ConsoleAdapterService` or
  `PosthogAdapterService`; only the abstract module's wiring was covered.~~
  **Fixed on `test/coverage-remaining`:** both adapters have a spec.
- ~~`config/analytics.scope.ts`'s `validate` function takes an untyped `raw`
  parameter, relying on `tsconfig.json` not being in strict mode (`TS1`) to
  avoid a `noImplicitAny` error.~~ **Fixed on `chore/typescript-strict`:** it
  is `(raw: Record<string, unknown>): AnalyticsScopeConfig`.
