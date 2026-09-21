# Templating — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/templating/`.

**Style-B registration** (adapter as module + provider token), like
`src/push-notification/`. Do not copy the style into a new module.

## Scope

Owns compiling a template to HTML: the abstract service, the dynamic module and
the pug adapter.

Does not own: the template files. Those are assets in `src/templates/` — see
`src/templates/CLAUDE.md`. Nor does it own delivery; `src/email/` takes the
compiled HTML.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `TemplateService` | `src/templating/abstract/template.service.ts` | `compile(nameOrPath, params)` — inject this |
| `TemplateModule` | `src/templating/template.module.ts` | `forRoot` / `forRootAsync` |
| `TEMPLATE_PROVIDER` | `src/templating/abstract/template-provider.const.ts` | Token an adapter module must provide |
| `PugAdapterModule`, `PugAdapterConfig` | `src/templating/pug-adapter/pug-adapter.module.ts` | Named only in `src/app.module.ts` |

## Configuration

`PugAdapterModule.register({ baseDir })` — `baseDir` defaults to the process
working directory, which is why the paths in `src/templates/template.const.ts`
are repo-relative. `src/app.module.ts` registers
`TemplateModule.forRoot({ adapter: PugAdapterModule.register({}), isGlobal: true })`.

`nest-cli.json` copies `**/*.pug` into `dist` as assets. A new engine's file
extension must be added there or templates will be missing from the build.

## Rules

1. Inject `TemplateService`. Never `PugAdapterService`.
2. Address a template through `TEMPLATE_PATHS[TEMPLATES.X]` from
   `src/templates/template.const.ts`. Never pass a hand-written path string.
3. `compile` returns HTML and nothing more. It does not send, store, or wrap.
4. An adapter module binds its service to `TEMPLATE_PROVIDER` and also aliases
   `TemplateService` with `useExisting`, then exports both —
   `src/templating/pug-adapter/pug-adapter.module.ts` is the reference.
5. Template parameters are typed through `TemplateParamsMap` in
   `src/templates/template-params.interface.ts`. Adding a template means adding
   its entry there.
6. An engine needing async config has two ways in, and either is fine: pass the
   adapter's own `registerAsync` result as `adapter:` to `forRoot`, or import it
   and hand `TEMPLATE_PROVIDER` back through `forRootAsync`. `forRootAsync`
   takes a factory, so it is also the way to build a `TemplateService` that
   never came from an adapter module.

## Adding an adapter

1. Create `src/templating/<engine>-adapter/<engine>-adapter.service.ts`
   implementing `TemplateService`.
2. Create `<engine>-adapter.module.ts` with `register`/`registerAsync` binding
   `TEMPLATE_PROVIDER` and aliasing `TemplateService` via `useExisting`.
3. Add the engine's file extension to `compilerOptions.assets` in `nest-cli.json`.
4. Pass the module as `adapter:` to `TemplateModule.forRoot` in `src/app.module.ts`.
5. Add `<engine>-adapter.service.unit.spec.ts`.

## Tests

`template.module.unit.spec.ts` covers both registration paths, by hand and
through a real container. `pug-adapter.service.unit.spec.ts` compiles fixture
templates from a temporary directory: the `baseDir` join, the working-directory
default that makes the repo-relative `TEMPLATE_PATHS` resolve, the failure for a
template that is not on disk, and that `#{}` escapes its parameter — rule 5 of
`src/templates/CLAUDE.md` is an XSS rule, so it gets a test.

## Reuse

Copy `src/templating/` whole; `pug-adapter/` needs `pug` and `@types/pug`.
Nothing here imports from another module of this template. Take
`src/templates/` with it if you want the typed registry, and copy the
`nest-cli.json` asset entry.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`N3`** — ~~`TemplateModule` has no `forRootAsync`, and no
  `validateAdapterModule` guard on any async path.~~ **Fixed on
  `chore/module-gaps`:** `forRootAsync` exists in the factory shape the rest of
  the template uses. It takes no adapter module, so there is nothing for
  `validateAdapterModule` to guard there; `forRoot` still guards its own.
- **`N7`** — ~~`!src/templates/template-renderer.interface.ts` duplicates this
  contract and is dead.~~ **Fixed on `chore/module-gaps`:**
  `!src/templates/template-renderer.interface.ts` is deleted.
- **`G1`** — ~~no tests.~~ **Fixed on `test/coverage-email-templating-push`:**
  the module and the pug adapter both have specs.
