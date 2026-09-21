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

## Reuse

**Two supported workflows.** Clone the template whole, or lift only the modules
you need — this one is written for both. What follows is the second case: what
`src/templating/` needs in order to compile in another project.

**What travels with it.** Copy `src/templating/` whole, then bring
`src/common/utils/nest-module-validation.ts`: `template.module.ts` calls
`validateAdapterModule` to fail loudly when `forRoot` is handed something that
is not an adapter module. That single function is this module's only edge to
another module of the template — copy the file, or inline the check.

Take `src/templates/` with it if you want the typed registry, and copy the
`nest-cli.json` asset entry or the `.pug` files will not reach `dist/`.

**Peer dependencies.**

```bash
pnpm add pug
pnpm add -D @types/pug      # pug-adapter/
```

`abstract/` needs only `@nestjs/common`.

**Removing it from the template instead.** `src/app.controller.ts` imports
`TemplateService` for its demo route; deleting that route clears the only
inbound edge outside `src/app.module.ts`.
