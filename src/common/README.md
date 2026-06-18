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


