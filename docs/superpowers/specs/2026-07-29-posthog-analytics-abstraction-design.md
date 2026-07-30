# PostHog Analytics Abstraction — Design

**Date:** 2026-07-29
**Status:** Approved for planning

## Context

The observability research (see `feat/monitoring` branch history and the
published research artifact) concluded PostHog as the product-analytics piece
of the stack, alongside Grafana/OpenTelemetry for infra observability. OTel
tracing is already implemented (`src/common/observability/telemetry/`). PostHog
itself has never been wired into the backend — it was discussed only for the
frontend so far.

Two concrete backend use cases were identified: capturing events that never
pass through a browser (emails sent, push notifications delivered, webhooks
processed, background jobs) and evaluating feature flags server-side before
deciding business logic. Both are covered by `posthog-node`.

This repo already has an established abstraction pattern for exactly this
situation — a capability with more than one possible backing implementation,
where consumers should depend on a contract, not a concrete class:
`LoggerService`/`LoggerAbstractModule` (`src/common/observability/logger/`) and
`EmailService`/`EmailAbstractModule` (`src/email/`). This design follows that
pattern.

## Goals

- Add an `AnalyticsService` abstract contract exposing exactly the two backend
  use cases identified: `capture()` for server-side events and
  `isFeatureEnabled()`/`getFeatureFlag()` for feature flags — nothing else
  (no `identify()`, no groups, no `alias()`) until a real need for them shows
  up.
- Provide two adapters: `PosthogAdapterService` (real `posthog-node` client)
  and `ConsoleAdapterService` (no-op, logs instead of sending) — mirroring
  email's real-adapter/`ConsoleAdapterService` split.
- Make the adapter choice explicit via config (`ANALYTICS_ADAPTER=POSTHOG|CONSOLE`),
  the same shape as `EMAIL_ADAPTER` in `email.scope.ts` — not automatic based on
  whether an API key is present, so the intended adapter is always legible from
  config alone.
- Make the PostHog host configurable (`POSTHOG_HOST`, default
  `https://us.i.posthog.com`) so a self-hosted PostHog instance can be pointed
  to later without touching code — same reversibility principle already used
  for `OTEL_EXPORTER_OTLP_ENDPOINT`.
- Register `AnalyticsService` as a global provider (`isGlobal: true`), same as
  `LoggerService`, so any module can inject it without importing
  `AnalyticsAbstractModule` directly.
- Flush pending events on shutdown: `PosthogAdapterService` implements
  `OnModuleDestroy` and calls the underlying client's `shutdown()` — a detail
  private to that adapter, not part of the abstract contract.

## Non-goals (explicitly out of scope for this pass)

- No frontend/`posthog-js` work — a separate concern for a separate template.
- No `identify()` / person-property syncing between frontend and backend
  `distinct_id`s — the two use cases approved (capture, feature flags) don't
  require it yet.
- No retrofitting `capture()` calls onto any existing service (email adapters,
  push notifications, etc.) — this pass only ships the abstraction, wiring it
  into real business events is separate follow-up work, same split already
  used for OTel's `@Span()` (shipped, not yet applied to a real method).
- No automatic adapter selection based on presence of an API key — adapter is
  always explicit via `ANALYTICS_ADAPTER`.
- No retry/circuit-breaker layer on top of `posthog-node` — the library
  already fails soft on feature-flag evaluation (returns `undefined`/`false`);
  `capture()` errors are caught and logged, not retried.

## Architecture

```
Consumer service (e.g. future SpaceshipModule event)
        │  inject AnalyticsService
        ▼
AnalyticsService (abstract contract)
        │  bound at runtime by AnalyticsAbstractModule.forRootAsync()
        ├── PosthogAdapterService  → posthog-node client → PostHog Cloud / self-hosted
        └── ConsoleAdapterService → LoggerService (no-op, logs intent only)
```

Config flows through the existing `ConfigProviderAbstractModule` scope
mechanism: `analyticsScope` is added to the `scopes` array next to `emailScope`,
validated with Joi, and injected into the `AnalyticsAbstractModule.forRootAsync`
factory in `app.module.ts` — same wiring shape as `EmailAbstractModule` today.

## Components / files

```
src/common/observability/analytics/
├── abstract/
│   ├── analytics.interfaces.ts         # CaptureEventInput
│   ├── analytics.service.ts            # abstract class AnalyticsService
│   └── analytics-abstract.module.ts    # forRoot / forRootAsync
├── posthog-adapter/
│   ├── posthog-adapter.service.ts
│   └── posthog-adapter-config.interface.ts
├── console-adapter/
│   └── console-adapter.service.ts
└── config/
    └── analytics.scope.ts              # ANALYTICS_ADAPTERS, AnalyticsScopeConfig, analyticsScope
```

### `abstract/analytics.interfaces.ts`

```typescript
export interface CaptureEventInput {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}
```

### `abstract/analytics.service.ts`

```typescript
export abstract class AnalyticsService {
  abstract capture(input: CaptureEventInput): void;
  abstract isFeatureEnabled(key: string, distinctId: string): Promise<boolean>;
  abstract getFeatureFlag(
    key: string,
    distinctId: string,
  ): Promise<string | boolean | undefined>;
}
```

### `abstract/analytics-abstract.module.ts`

Same shape as `EmailAbstractModule`: `forRoot({ adapter, isGlobal })` and
`forRootAsync({ imports, inject, useFactory, isGlobal })`, both providing
`AnalyticsService` and exporting it.

### `posthog-adapter/posthog-adapter.service.ts`

Wraps a `posthog-node` `PostHog` client instance, constructed from
`PosthogAdapterConfig` (`{ apiKey: string; host: string }`).

- `capture()` calls the client's `capture()` (fire-and-forget, batched
  internally by `posthog-node`) inside a try/catch — a throw here must never
  break the caller's business logic, matching the "telemetry must never break
  the app" precedent already set by `LoggerService.emitTelemetry`.
- `isFeatureEnabled()` / `getFeatureFlag()` delegate directly to the client's
  own methods (already fail-soft).
- Implements `OnModuleDestroy` → `await this.client.shutdown()`.

### `console-adapter/console-adapter.service.ts`

No-op implementation used when `ANALYTICS_ADAPTER=CONSOLE` (the default).
Logs each `capture()` call and flag check via `LoggerService` instead of
sending anything, same role as email's `ConsoleAdapterService`.
`isFeatureEnabled()` resolves `false`, `getFeatureFlag()` resolves `undefined`.

### `config/analytics.scope.ts`

```typescript
export const ANALYTICS_ADAPTERS = {
  POSTHOG: 'POSTHOG',
  CONSOLE: 'CONSOLE',
} as const;

export type AnalyticsScopeConfig = {
  adapter: string;
  posthogApiKey: string;
  posthogHost: string;
};
```

Joi validation: `adapter` defaults to `ANALYTICS_ADAPTERS.CONSOLE`;
`posthogApiKey` optional, defaults to `''`; `posthogHost` optional, defaults to
`'https://us.i.posthog.com'`. Same `defineConfigScope`/`configSources` helpers
as `email.scope.ts`.

### `app.module.ts` wiring

```typescript
AnalyticsAbstractModule.forRootAsync({
  inject: [analyticsScope.KEY],
  useFactory: (analytics: AnalyticsScopeConfig) =>
    analytics.adapter === ANALYTICS_ADAPTERS.POSTHOG
      ? new PosthogAdapterService({
          apiKey: analytics.posthogApiKey,
          host: analytics.posthogHost,
        })
      : new ConsoleAdapterService(),
  isGlobal: true,
}),
```

`analyticsScope` added to the `ConfigProviderAbstractModule.forRootAsync`
`scopes` array, next to `emailScope`.

### `.env.example`

```
ANALYTICS_ADAPTER=CONSOLE
POSTHOG_API_KEY=
POSTHOG_HOST=https://us.i.posthog.com
```

### `package.json`

New dependency: `posthog-node`.

## Error handling

- `capture()` never throws — `PosthogAdapterService` wraps the client call in
  try/catch and logs failures via `LoggerService`, matching
  `emitTelemetry`'s existing swallow-and-log precedent.
- `isFeatureEnabled()`/`getFeatureFlag()` rely on `posthog-node`'s own
  fail-soft behavior (resolves `false`/`undefined` on network/eval failure)
  — no additional wrapping.
- Config validation (`analyticsScope`) throws at startup on invalid values,
  same as every other scope — fail fast on misconfiguration, fail soft at
  runtime on transient provider issues.

## Testing

Matches `src/email/`'s actual coverage level exactly (checked against the
real repo state, not assumed): no `*.scope.ts` file in this codebase has a
unit spec, and none of the email adapters (`sendgrid`, `resend`, `aws-ses`,
`console`) have one either — only `logger/`'s adapters and abstract module
are tested. Since analytics is modeled on `email/`, it follows `email/`'s
level, not `logger/`'s:

- `analytics-abstract.module.unit.spec.ts` — `forRoot`/`forRootAsync` wiring
  (the one piece with real conditional logic worth testing, same reasoning
  as `logger-abstract.module.unit.spec.ts`).
- No spec for `analytics.scope.ts`, `posthog-adapter.service.ts`, or
  `console-adapter.service.ts` — consistent with zero test files existing for
  the equivalent email scope/adapters today.

## Alternatives considered

- **Fold PostHog capture into the existing `LoggerService.telemetryHook`**
  instead of a new abstraction. Rejected: the hook is designed for trace/log
  correlation (OTel span events), a different concern from product analytics;
  it also has no way to express feature-flag evaluation, one of the two
  approved use cases.
- **Automatic adapter selection** (PostHog if an API key is present, Console
  otherwise) instead of an explicit `ANALYTICS_ADAPTER` variable. Rejected by
  the user in favor of explicit config, consistent with `EMAIL_ADAPTER`.
- **Single adapter class that internally no-ops when no API key is set**,
  instead of two separate adapter classes. Rejected: conflates two
  responsibilities (real PostHog client vs. no-op) in one class; the two-class
  split mirrors email's `SendgridAdapterService`/`ConsoleAdapterService` split.
