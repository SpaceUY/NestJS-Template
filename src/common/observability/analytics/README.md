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
import { AnalyticsService } from './common/observability/analytics/abstract/analytics.service';

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
