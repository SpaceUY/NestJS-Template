# Common Utilities and Building Blocks

This folder contains reusable helpers and primitives shared across modules (decorators, exceptions, utils, etc.).

---

## Contents

- Decorators
  - `decorators/html-content-type.ts`: Adds `Content-Type: text/html` to controller responses.
- Exceptions
  - `exception/`: Base exception classes and registration.
- Utils
  - `utils/nest-module-validation.ts`: Runtime validation for dynamic module adapters.

---

## Utils: Nest Module Validation

`validateAdapterModule(adapter, featureName?)`

Purpose: Validate that a provided adapter is a valid NestJS module shape (class, DynamicModule, forwardRef wrapper, or Promise resolving to DynamicModule). This is useful in `forRoot`/`forRootAsync` of dynamic modules to fail fast with helpful messages.

Signature:

```ts
import type { AdapterModuleLike } from './utils/nest-module-validation';
export function validateAdapterModule(adapter: AdapterModuleLike, featureName?: string): void
```

Accepted shapes:
- Module class: `class MyModule {}`
- Dynamic module: `{ module: MyModule, providers: [...] }`
- ForwardRef wrapper: `forwardRef(() => MyModule)`
- Promise resolving to a DynamicModule: `Promise<DynamicModule>`

Example usage in a dynamic module:

```ts
import { Module, DynamicModule } from '@nestjs/common';
import { validateAdapterModule } from '../common/utils/nest-module-validation';

type Adapter = Parameters<typeof validateAdapterModule>[0];

interface MyFeatureOptions {
  adapter: Adapter;
  isGlobal?: boolean;
}

@Module({})
export class MyFeatureModule {
  static forRoot(options: MyFeatureOptions): DynamicModule {
    const { adapter, isGlobal = false } = options;
    validateAdapterModule(adapter, 'MyFeatureModule.forRoot');

    return {
      module: MyFeatureModule,
      global: isGlobal,
      imports: [adapter],
      providers: [],
      exports: [],
    };
  }
}
```

Behavior on invalid input:
- Throws an `Error` with a descriptive message including a best-effort name for the adapter (class name, DynamicModule.module name, etc.).

---

## Reuse

**Two supported workflows.** Clone the template whole, or lift only the modules
you need — this one is written for both. What follows is the second case: what
`src/common/` needs in order to compile in another project.

**What travels with it.** Nothing. `src/common/` imports from no other module
of the template — it is the platform tier, and seven modules import *from* it,
so it is the first thing to lift and the last thing to delete.

**Copy per directory, not per module.**

- `exception/`, `utils/` and `decorators/` are self-contained and need only
  `@nestjs/common`.
- `observability/logger/` is what `analytics`, `cloud-storage`,
  `config-provider`, `email` and `queues` all reach for. Taking any of those
  means taking this.
- `observability/telemetry/` needs the OpenTelemetry packages listed in
  `src/common/observability/telemetry/README.md`.
- `middleware/` is opinionated about response shape — copy it only if the
  target project wants the `{ success, data }` envelope. Both classes import
  `observability/logger/` (optionally injected, so no DI requirement — but the
  import must resolve). It needs `rxjs`, and one non-import dependency worth
  knowing about:
  `src/common/middleware/response.interceptor.ts` only type-checks because of
  the ambient `Express.User` augmentation the repo root ships in
  `@types/express/index.d.ts`. Nothing imports it — it applies because this
  repo's `tsconfig.json` sets no `include`, so every `.d.ts` under the project
  root is compiled. Copy that `@types/` directory across and check that the
  destination's `tsconfig.json` really covers where you put it (under
  `"include": ["src"]` it does not, so move the file into `src/`). Otherwise
  the interceptor fails to compile — and no import error will point at the
  cause, because nothing imports the file.

**Removing it from the template instead.** You cannot, until every module that
imports it has gone. `pnpm run modularity:check -- --report` names them.

---

## Decorators

### Html

Adds `Content-Type: text/html` to a controller method response.

```ts
import { Controller, Get } from '@nestjs/common';
import { Html } from '../common/decorators/html-content-type';

@Controller('pages')
export class PagesController {
  @Get('about')
  @Html()
  about(): string {
    return '<h1>About</h1>';
  }
}
```


