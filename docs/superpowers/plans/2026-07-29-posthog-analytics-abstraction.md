# PostHog Analytics Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend analytics abstraction (`AnalyticsService`) under `src/common/observability/analytics/` with a PostHog adapter and a no-op console adapter, wired into `app.module.ts` via an explicit `ANALYTICS_ADAPTER` config value — following the exact abstract+adapter+config-scope shape already used by `EmailAbstractModule`/`EmailService`.

**Architecture:** `AnalyticsService` is an abstract class exposing `capture()`, `isFeatureEnabled()`, and `getFeatureFlag()`. `AnalyticsAbstractModule.forRootAsync()` binds it at runtime to either `PosthogAdapterService` (real `posthog-node` client) or `ConsoleAdapterService` (logs instead of sending), chosen by `analyticsScope.adapter` — a Joi-validated config scope read from `ANALYTICS_ADAPTER`/`POSTHOG_API_KEY`/`POSTHOG_HOST`.

**Tech Stack:** NestJS (`DynamicModule`, `OnModuleDestroy`), `posthog-node`, `joi` (via the existing `config-provider` scope helpers), Jest.

## Global Constraints

- No test files for `analytics.scope.ts`, `posthog-adapter.service.ts`, or `console-adapter.service.ts` — matches the real, verified coverage level of `src/email/` (zero scope/adapter tests exist there today). Only `analytics-abstract.module.unit.spec.ts` is written, matching `logger-abstract.module.unit.spec.ts`.
- `ANALYTICS_ADAPTER` defaults to `CONSOLE` — analytics is off (no real network calls) unless explicitly turned on, same "off by default" principle as OTel's `OTEL_EXPORTER_OTLP_ENDPOINT`.
- `POSTHOG_HOST` defaults to `https://us.i.posthog.com` (PostHog Cloud, US region) and must be overridable without touching code — this is what makes self-hosted PostHog reachable later.
- `capture()` must never throw — wrap the underlying client call in try/catch, log failures via `LoggerService`, swallow them (matches `LoggerService.emitTelemetry`'s existing precedent at `src/common/observability/logger/abstract/logger.service.ts:26-32`).
- No `identify()`, group analytics, or `alias()` — out of scope per the design doc's Non-goals.
- Before writing `posthog-adapter.service.ts`, verify the installed `posthog-node` package's actual exported types (`node_modules/posthog-node/lib/**/*.d.ts` or its main type declaration) match the constructor/method signatures used below — this session already hit three OTel SDK API mismatches by trusting memory instead of checking installed `.d.ts` files; do the same check here before assuming `posthog-node`'s API surface is exactly as described.

---

### Task 1: Install `posthog-node` and add the abstract contract

**Files:**
- Modify: `package.json` (add `posthog-node` dependency)
- Create: `src/common/observability/analytics/abstract/analytics.interfaces.ts`
- Create: `src/common/observability/analytics/abstract/analytics.service.ts`

**Interfaces:**
- Produces: `CaptureEventInput { distinctId: string; event: string; properties?: Record<string, unknown> }` and `abstract class AnalyticsService { capture(input: CaptureEventInput): void; isFeatureEnabled(key: string, distinctId: string): Promise<boolean>; getFeatureFlag(key: string, distinctId: string): Promise<string | boolean | undefined>; }` — both consumed by every later task.

- [ ] **Step 1: Install the dependency**

Run: `pnpm add posthog-node`

Expected: `posthog-node` appears under `dependencies` in `package.json`, `pnpm-lock.yaml` updates.

- [ ] **Step 2: Verify the installed package's actual API surface**

Run: `find node_modules/posthog-node -iname "*.d.ts" | head -5` and read the main type declaration file (likely `node_modules/posthog-node/lib/node/index.d.ts` or similar — the exact path depends on the installed version).

Confirm the exported `PostHog` class constructor accepts `(apiKey: string, options?: { host?: string })`, and that it has `capture(props: { distinctId: string; event: string; properties?: Record<string, unknown> })`, `isFeatureEnabled(key: string, distinctId: string): Promise<boolean | undefined>`, `getFeatureFlag(key: string, distinctId: string): Promise<string | boolean | undefined>`, and `shutdown(): Promise<void>`.

If any signature differs from what's assumed above, note the actual signature — Task 3 (the PostHog adapter) must match the installed types exactly, not this plan's assumption.

- [ ] **Step 3: Create the interfaces file**

```typescript
// src/common/observability/analytics/abstract/analytics.interfaces.ts
export interface CaptureEventInput {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}
```

- [ ] **Step 4: Create the abstract service**

```typescript
// src/common/observability/analytics/abstract/analytics.service.ts
import { CaptureEventInput } from './analytics.interfaces';

/**
 * Contract all analytics adapters must satisfy. Inject this token in other
 * modules — never a concrete adapter class — so the adapter can be swapped
 * without touching consumers.
 */
export abstract class AnalyticsService {
  abstract capture(input: CaptureEventInput): void;
  abstract isFeatureEnabled(key: string, distinctId: string): Promise<boolean>;
  abstract getFeatureFlag(
    key: string,
    distinctId: string,
  ): Promise<string | boolean | undefined>;
}
```

- [ ] **Step 5: Confirm the project still builds**

Run: `pnpm run build`
Expected: succeeds (these two new files have no consumers yet, so nothing else can break).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/common/observability/analytics/abstract/analytics.interfaces.ts src/common/observability/analytics/abstract/analytics.service.ts
git commit -m "feat: add posthog-node dependency and AnalyticsService abstract contract"
```

---

### Task 2: `AnalyticsAbstractModule` (`forRoot`/`forRootAsync`) with test

**Files:**
- Create: `src/common/observability/analytics/abstract/analytics-abstract.module.ts`
- Test: `src/common/observability/analytics/abstract/analytics-abstract.module.unit.spec.ts`

**Interfaces:**
- Consumes: `AnalyticsService` from Task 1 (`src/common/observability/analytics/abstract/analytics.service.ts`).
- Produces: `AnalyticsAbstractModule` with static `forRoot(options: { adapter: Type<AnalyticsService>; isGlobal?: boolean }): DynamicModule` and `forRootAsync(options: { imports?: ModuleMetadata['imports']; inject?: InjectionToken[]; useFactory: (...args: any[]) => Promise<AnalyticsService> | AnalyticsService; isGlobal?: boolean }): DynamicModule` — both exporting `AnalyticsService`. Consumed by Task 5 (`app.module.ts` wiring).

- [ ] **Step 1: Write the failing test**

```typescript
// src/common/observability/analytics/abstract/analytics-abstract.module.unit.spec.ts
import { AnalyticsAbstractModule } from './analytics-abstract.module';
import { AnalyticsService } from './analytics.service';
import { CaptureEventInput } from './analytics.interfaces';

class MockAdapter extends AnalyticsService {
  capture = jest.fn();
  isFeatureEnabled = jest.fn(async () => false);
  getFeatureFlag = jest.fn(async () => undefined);
}

describe('AnalyticsAbstractModule', () => {
  describe('forRoot', () => {
    it('should bind the adapter class to AnalyticsService', () => {
      const moduleRef = AnalyticsAbstractModule.forRoot({ adapter: MockAdapter });

      const provider = (
        moduleRef.providers as Array<{
          provide: unknown;
          useClass: unknown;
        }>
      ).find((p) => p.provide === AnalyticsService);

      expect(moduleRef.module).toBe(AnalyticsAbstractModule);
      expect(moduleRef.global).toBe(false);
      expect(provider?.useClass).toBe(MockAdapter);
      expect(moduleRef.exports).toContain(AnalyticsService);
    });

    it('should set isGlobal when specified', () => {
      const moduleRef = AnalyticsAbstractModule.forRoot({
        adapter: MockAdapter,
        isGlobal: true,
      });

      expect(moduleRef.global).toBe(true);
    });
  });

  describe('forRootAsync', () => {
    it('should resolve the factory-returned instance as AnalyticsService', async () => {
      const adapterInstance = new MockAdapter();
      const token = 'SOME_TOKEN';
      const tokenValue = 'some-value';

      const moduleRef = AnalyticsAbstractModule.forRootAsync({
        inject: [token],
        useFactory: (val: string) => {
          expect(val).toBe(tokenValue);
          return adapterInstance;
        },
        isGlobal: true,
      });

      const provider = (
        moduleRef.providers as Array<{
          provide: unknown;
          inject: unknown[];
          useFactory: (
            ...args: unknown[]
          ) => Promise<AnalyticsService> | AnalyticsService;
        }>
      ).find((p) => p.provide === AnalyticsService);

      const resolved = await provider!.useFactory(tokenValue);

      expect(moduleRef.global).toBe(true);
      expect(provider!.inject).toEqual([token]);
      expect(resolved).toBe(adapterInstance);
      expect(moduleRef.exports).toContain(AnalyticsService);
    });

    it('should default imports and inject to empty arrays when omitted', () => {
      const moduleRef = AnalyticsAbstractModule.forRootAsync({
        useFactory: () => new MockAdapter(),
      });

      expect(moduleRef.imports).toEqual([]);

      const provider = (
        moduleRef.providers as Array<{ provide: unknown; inject: unknown[] }>
      ).find((p) => p.provide === AnalyticsService);

      expect(provider!.inject).toEqual([]);
    });
  });
});
```

Note: this test file references `CaptureEventInput` only to keep the import consistent with how adapters will use it later — if the linter flags it as unused, drop the import; it is not otherwise required by these test cases.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- analytics-abstract.module.unit.spec.ts`
Expected: FAIL — `Cannot find module './analytics-abstract.module'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/common/observability/analytics/abstract/analytics-abstract.module.ts
import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
  Type,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

interface AnalyticsModuleOptions {
  adapter: Type<AnalyticsService>;
  isGlobal?: boolean;
}

interface AnalyticsModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => Promise<AnalyticsService> | AnalyticsService;
  isGlobal?: boolean;
}

@Module({})
export class AnalyticsAbstractModule {
  static forRoot(options: AnalyticsModuleOptions): DynamicModule {
    const { adapter, isGlobal = false } = options;

    return {
      module: AnalyticsAbstractModule,
      global: isGlobal,
      providers: [
        {
          provide: AnalyticsService,
          useClass: adapter,
        },
      ],
      exports: [AnalyticsService],
    };
  }

  static forRootAsync(options: AnalyticsModuleAsyncOptions): DynamicModule {
    const { isGlobal = false } = options;

    return {
      module: AnalyticsAbstractModule,
      global: isGlobal,
      imports: options.imports || [],
      providers: [
        {
          provide: AnalyticsService,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [AnalyticsService],
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- analytics-abstract.module.unit.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/common/observability/analytics/abstract/analytics-abstract.module.ts src/common/observability/analytics/abstract/analytics-abstract.module.unit.spec.ts
git commit -m "feat: add AnalyticsAbstractModule forRoot/forRootAsync"
```

---

### Task 3: `PosthogAdapterService`

**Files:**
- Create: `src/common/observability/analytics/posthog-adapter/posthog-adapter-config.interface.ts`
- Create: `src/common/observability/analytics/posthog-adapter/posthog-adapter.service.ts`

**Interfaces:**
- Consumes: `AnalyticsService`, `CaptureEventInput` from Task 1; `LoggerService` from `src/common/observability/logger/abstract/logger.service.ts`; `NestLoggerAdapter` from `src/common/observability/logger/nest-adapter/nest-logger.adapter.ts` (constructor takes an optional `context` string, defaults to `'App'` — see `src/common/observability/logger/nest-adapter/nest-logger.adapter.ts:8-12`).
- Produces: `PosthogAdapterConfig { apiKey: string; host: string }` and `PosthogAdapterService` (implements `AnalyticsService`, `OnModuleDestroy`) — constructed with `new PosthogAdapterService(config: PosthogAdapterConfig, logger?: LoggerService)`, consumed by Task 5's `app.module.ts` factory.

No test file for this task (see Global Constraints — matches `src/email/`'s adapter coverage, which has none).

- [ ] **Step 1: Create the config interface**

```typescript
// src/common/observability/analytics/posthog-adapter/posthog-adapter-config.interface.ts
export interface PosthogAdapterConfig {
  apiKey: string;
  host: string;
}
```

- [ ] **Step 2: Write the adapter**

Use the constructor/method signatures confirmed in Task 1 Step 2 against the actually-installed `posthog-node` types. The shape below assumes the standard `posthog-node` v5.x API (`new PostHog(apiKey, { host })`, `capture({ distinctId, event, properties })`, `isFeatureEnabled(key, distinctId)`, `getFeatureFlag(key, distinctId)`, `shutdown()`) — adjust only if Task 1's verification found a different signature.

```typescript
// src/common/observability/analytics/posthog-adapter/posthog-adapter.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PostHog } from 'posthog-node';
import { AnalyticsService } from '../abstract/analytics.service';
import { CaptureEventInput } from '../abstract/analytics.interfaces';
import { PosthogAdapterConfig } from './posthog-adapter-config.interface';
import { LoggerService } from '../../logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../logger/nest-adapter/nest-logger.adapter';

@Injectable()
export class PosthogAdapterService
  extends AnalyticsService
  implements OnModuleDestroy
{
  private readonly client: PostHog;
  private readonly logger: LoggerService;

  constructor(config: PosthogAdapterConfig, logger?: LoggerService) {
    super();
    this.client = new PostHog(config.apiKey, { host: config.host });
    this.logger = logger ?? new NestLoggerAdapter(PosthogAdapterService.name);
  }

  capture(input: CaptureEventInput): void {
    try {
      this.client.capture({
        distinctId: input.distinctId,
        event: input.event,
        properties: input.properties,
      });
    } catch (error) {
      this.logger.error({
        message: 'PostHog capture failed',
        data: { event: input.event },
        error,
      });
    }
  }

  async isFeatureEnabled(key: string, distinctId: string): Promise<boolean> {
    const result = await this.client.isFeatureEnabled(key, distinctId);
    return result ?? false;
  }

  async getFeatureFlag(
    key: string,
    distinctId: string,
  ): Promise<string | boolean | undefined> {
    return this.client.getFeatureFlag(key, distinctId);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.shutdown();
  }
}
```

- [ ] **Step 3: Confirm the project builds**

Run: `pnpm run build`
Expected: succeeds. If it fails on a `posthog-node` type mismatch, fix the adapter to match the actual installed types (do not change `posthog-node`'s version to force a match — the plan targets whatever version Task 1 installed).

- [ ] **Step 4: Commit**

```bash
git add src/common/observability/analytics/posthog-adapter/
git commit -m "feat: add PosthogAdapterService"
```

---

### Task 4: `ConsoleAdapterService` (no-op)

**Files:**
- Create: `src/common/observability/analytics/console-adapter/console-adapter.service.ts`

**Interfaces:**
- Consumes: `AnalyticsService`, `CaptureEventInput` from Task 1; `LoggerService`/`NestLoggerAdapter` (same as Task 3).
- Produces: `ConsoleAdapterService` (implements `AnalyticsService`), constructed with `new ConsoleAdapterService(logger?: LoggerService)`, consumed by Task 5's `app.module.ts` factory.

No test file for this task (matches `src/email/console-adapter/console-adapter.service.ts`, which has none).

- [ ] **Step 1: Write the adapter**

```typescript
// src/common/observability/analytics/console-adapter/console-adapter.service.ts
import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../abstract/analytics.service';
import { CaptureEventInput } from '../abstract/analytics.interfaces';
import { LoggerService } from '../../logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../logger/nest-adapter/nest-logger.adapter';

@Injectable()
export class ConsoleAdapterService extends AnalyticsService {
  private readonly logger: LoggerService;

  constructor(logger?: LoggerService) {
    super();
    this.logger = logger ?? new NestLoggerAdapter(ConsoleAdapterService.name);
  }

  capture(input: CaptureEventInput): void {
    this.logger.log({
      message: 'Analytics event (console adapter, not sent)',
      data: {
        distinctId: input.distinctId,
        event: input.event,
        properties: input.properties,
      },
    });
  }

  async isFeatureEnabled(key: string, distinctId: string): Promise<boolean> {
    this.logger.debug({
      message: 'Feature flag check (console adapter, always false)',
      data: { key, distinctId },
    });
    return false;
  }

  async getFeatureFlag(
    key: string,
    distinctId: string,
  ): Promise<string | boolean | undefined> {
    this.logger.debug({
      message: 'Feature flag lookup (console adapter, always undefined)',
      data: { key, distinctId },
    });
    return undefined;
  }
}
```

- [ ] **Step 2: Confirm the project builds**

Run: `pnpm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/common/observability/analytics/console-adapter/
git commit -m "feat: add ConsoleAdapterService no-op analytics adapter"
```

---

### Task 5: `analytics.scope.ts` config and `app.module.ts` wiring

**Files:**
- Create: `src/common/observability/analytics/config/analytics.scope.ts`
- Modify: `src/app.module.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `defineConfigScope` and `configSources` from `src/config-provider/abstract/define-config-scope.util.ts` and `src/config-provider/abstract/config-source.util.ts` (same helpers `email.scope.ts` uses); `AnalyticsAbstractModule` (Task 2), `PosthogAdapterService`/`PosthogAdapterConfig` (Task 3), `ConsoleAdapterService` (Task 4).
- Produces: `ANALYTICS_ADAPTERS = { POSTHOG: 'POSTHOG', CONSOLE: 'CONSOLE' }`, `AnalyticsScopeConfig { adapter: string; posthogApiKey: string; posthogHost: string }`, `analyticsScope` (a `ConfigScopeDefinition<AnalyticsScopeConfig>`) — nothing later depends on this; it is the final integration point.

No test file for `analytics.scope.ts` (see Global Constraints).

- [ ] **Step 1: Write the config scope**

```typescript
// src/common/observability/analytics/config/analytics.scope.ts
import Joi from 'joi';
import { configSources as from } from '../../../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../../../config-provider/abstract/define-config-scope.util';

export const ANALYTICS_ADAPTERS = {
  POSTHOG: 'POSTHOG',
  CONSOLE: 'CONSOLE',
} as const;

export type AnalyticsScopeConfig = {
  adapter: string;
  posthogApiKey: string;
  posthogHost: string;
};

const validate = (raw) => {
  const schema = Joi.object<AnalyticsScopeConfig>({
    adapter: Joi.string()
      .valid(...Object.values(ANALYTICS_ADAPTERS))
      .default(ANALYTICS_ADAPTERS.CONSOLE),
    posthogApiKey: Joi.string().optional().default(''),
    posthogHost: Joi.string().optional().default('https://us.i.posthog.com'),
  });

  const { error, value } = schema.validate(raw, { abortEarly: false });
  if (error) throw new Error(error.message);
  return value;
};

export const analyticsScope = defineConfigScope<AnalyticsScopeConfig>(
  'analytics',
  {
    adapter: from.env('ANALYTICS_ADAPTER'),
    posthogApiKey: from.env('POSTHOG_API_KEY'),
    posthogHost: from.env('POSTHOG_HOST'),
  },
  validate,
);
```

Note: verify the relative import depth (`../../../../config-provider/...`) against the actual location of `src/common/observability/analytics/config/analytics.scope.ts` relative to `src/config-provider/` before running — count directories carefully (`analytics/config/` → `analytics/` → `observability/` → `common/` → `src/`, then into `config-provider/`), matching how `src/email/config/email.scope.ts` reaches `../../config-provider/...` from one directory shallower.

- [ ] **Step 2: Confirm the project builds**

Run: `pnpm run build`
Expected: succeeds.

- [ ] **Step 3: Wire into `app.module.ts`**

Add these imports near the existing `emailScope`/`EmailAbstractModule` imports in `src/app.module.ts`:

```typescript
import {
  analyticsScope,
  AnalyticsScopeConfig,
  ANALYTICS_ADAPTERS,
} from './common/observability/analytics/config/analytics.scope';
import { AnalyticsAbstractModule } from './common/observability/analytics/abstract/analytics-abstract.module';
import { PosthogAdapterService } from './common/observability/analytics/posthog-adapter/posthog-adapter.service';
import { ConsoleAdapterService as AnalyticsConsoleAdapterService } from './common/observability/analytics/console-adapter/console-adapter.service';
```

(Aliased to `AnalyticsConsoleAdapterService` because `app.module.ts` already imports an unrelated `ConsoleAdapterService` from the email module — see `src/app.module.ts:34`.)

Add `analyticsScope` to the `scopes` array inside `ConfigProviderAbstractModule.forRootAsync` (currently at `src/app.module.ts:52-60`):

```typescript
scopes: [
  appScope,
  jwtScope,
  googleScope,
  s3Scope,
  emailScope,
  expoScope,
  databaseScope,
  analyticsScope,
],
```

Add the module registration to the `imports` array, next to `EmailAbstractModule.forRootAsync(...)`:

```typescript
AnalyticsAbstractModule.forRootAsync({
  inject: [analyticsScope.KEY],
  useFactory: (analytics: AnalyticsScopeConfig) =>
    analytics.adapter === ANALYTICS_ADAPTERS.POSTHOG
      ? new PosthogAdapterService({
          apiKey: analytics.posthogApiKey,
          host: analytics.posthogHost,
        })
      : new AnalyticsConsoleAdapterService(),
  isGlobal: true,
}),
```

- [ ] **Step 4: Add env vars to `.env.example`**

Append after the existing `OTEL_SERVICE_NAME` line:

```
# Analytics — leave ANALYTICS_ADAPTER=CONSOLE to log events instead of sending them.
ANALYTICS_ADAPTER=CONSOLE
POSTHOG_API_KEY=
POSTHOG_HOST=https://us.i.posthog.com
```

- [ ] **Step 5: Run the full build and test suite**

Run: `pnpm run build && pnpm test`
Expected: build succeeds; all existing tests plus the new `analytics-abstract.module.unit.spec.ts` pass.

- [ ] **Step 6: Manually sanity-check the default (CONSOLE) path boots**

Run: `pnpm run start:dev` (or equivalent dev script) with no `ANALYTICS_ADAPTER` set in the environment, confirm the app boots without throwing (the `ConsoleAdapterService` path requires no API key, so this must work with zero PostHog config present — mirrors how the app boots today with no `OTEL_EXPORTER_OTLP_ENDPOINT` set).

Stop the process after confirming a clean boot (e.g. a log line showing Nest's routes being mapped, no unhandled exception).

- [ ] **Step 7: Commit**

```bash
git add src/common/observability/analytics/config/analytics.scope.ts src/app.module.ts .env.example
git commit -m "feat: wire AnalyticsService (PostHog/Console) into AppModule"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Design doc's Goals/Components map 1:1 to Tasks 1–5 (interfaces+abstract class → Task 1; abstract module → Task 2; PostHog adapter + shutdown → Task 3; console adapter → Task 4; config scope + app.module.ts wiring + `.env.example` + `package.json` dependency → Tasks 1 & 5). Non-goals (no `identify()`, no auto-adapter-selection, no retry layer) are respected — none of the tasks add them.
- **Testing correction applied:** the design doc originally called for specs on `analytics.scope.ts` and both adapters; this was corrected (design doc updated in the same session) after verifying `src/email/` — the pattern being mirrored — has zero test coverage for its own scope/adapters. Only the abstract module (Task 2) is tested, matching `logger-abstract.module.unit.spec.ts`.
- **Type consistency:** `CaptureEventInput`, `AnalyticsService`, `AnalyticsScopeConfig`, `ANALYTICS_ADAPTERS`, `PosthogAdapterConfig` are defined once (Tasks 1, 3, 5) and referenced with the same names/shapes in every later task.
