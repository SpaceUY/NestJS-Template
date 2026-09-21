# Analytics Module

Provider-agnostic server-side analytics: event capture and feature flags,
backed by [PostHog](https://posthog.com/), with a no-op console fallback for
local development.

Consumers depend only on `AnalyticsService` (the abstract class). The concrete
adapter — PostHog or console — is wired at module registration time in
`app.module.ts` and is invisible to the rest of the codebase.

---

## Configuration

| Env var | Default | Behavior |
|---|---|---|
| `ANALYTICS_ADAPTER` | `CONSOLE` | `CONSOLE` logs events/flag checks instead of sending them; `POSTHOG` sends real events via the PostHog client. |
| `POSTHOG_API_KEY` | `''` | Required (non-empty) when `ANALYTICS_ADAPTER=POSTHOG`; ignored otherwise. Boot fails fast with a Joi error if `POSTHOG` is selected with no key. |
| `POSTHOG_HOST` | `https://us.i.posthog.com` | PostHog ingestion host. Only relevant when `ANALYTICS_ADAPTER=POSTHOG`. |

---

## Consuming `AnalyticsService`

```ts
import { Injectable } from '@nestjs/common';
import { AnalyticsService } from './analytics/abstract/analytics.service';

@Injectable()
export class SomeService {
  constructor(private readonly analytics: AnalyticsService) {}

  async doSomething(userId: string): Promise<void> {
    this.analytics.capture({
      distinctId: userId,
      event: 'something_happened',
    });

    const enabled = await this.analytics.isFeatureEnabled('new-flow', userId);
    // ...
  }
}
```

`AnalyticsAbstractModule` is registered globally in `app.module.ts`, so
`AnalyticsService` can be injected anywhere without additional imports.

---

Note: `posthog-node` ships an official `./nestjs` entrypoint, but this repo
deliberately doesn't use it — sticking with the same provider-agnostic
abstraction pattern used by `email` and `logger` keeps PostHog swappable
without touching consumers.

## Reuse

**Two supported workflows.** Clone the template whole, or lift only the modules
you need — this one is written for both. What follows is the second case: what
`src/analytics/` needs in order to compile in another project.

**What travels with it.** Copy `src/analytics/` whole, then bring:

- `src/config-provider/abstract/` — `config/analytics.scope.ts` builds its scope
  with `configSources` and `defineConfigScope` from there.
- `src/common/observability/logger/` — both adapters take an optional
  `LoggerService` and fall back to `NestLoggerAdapter`. Drop that parameter and
  this dependency goes with it.

**Peer dependencies.**

```bash
pnpm add joi            # the config scope
pnpm add posthog-node   # posthog-adapter/ only
```

`abstract/` and `console-adapter/` need only `@nestjs/common`.

**Removing it from the template instead.** Nothing imports `src/analytics/`, so
it comes out in three edits: its registration in `src/app.module.ts`, its scope
in that file's `scopes` array, and the `ANALYTICS_*` / `POSTHOG_*` keys in
`.env.example`.
