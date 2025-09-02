# Templating Module

A reusable, provider-agnostic service layer for compiling templates to HTML. This module is independent from the `src/templates` assets folder, which holds your actual template files and their type definitions.

---

## Registering

```ts
import { Module } from '@nestjs/common';
import { TemplateModule } from './templating/template.module';
import { PugAdapterModule } from './templating/pug-adapter/pug-adapter.module';

@Module({
  imports: [
    TemplateModule.forRoot({
      adapter: PugAdapterModule.register({ baseDir: process.cwd() }),
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

---

## Using

```ts
import { Injectable } from '@nestjs/common';
import { TemplateService } from './templating/abstract/template.service';
import { TEMPLATES, TEMPLATE_PATHS } from './templates/template.const';

@Injectable()
export class Example {
  constructor(private readonly templates: TemplateService) {}

  async build(): Promise<string> {
    return this.templates.compile(
      TEMPLATE_PATHS[TEMPLATES.WELCOME],
      { name: 'Alice' },
    );
  }
}
```

---

## Creating new adapters

Implement `TemplateService` and provide it via `TEMPLATE_PROVIDER` in your adapter module. See `pug-adapter` for a reference implementation.

---

## Separation of concerns

- `src/templating`: service-level code (module, abstractions, adapters)
- `src/templates`: template assets (pug files) and type-safe registries/constants
