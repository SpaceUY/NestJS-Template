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
| `TemplateModule` | `src/templating/template.module.ts` | `forRoot` only |
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
6. `TemplateModule` has no `forRootAsync` (finding `N3`). An engine needing
   async config uses the adapter's own `registerAsync` — `PugAdapterModule`
   already has one — and passes the result as `adapter:`.

## Adding an adapter

1. Create `src/templating/<engine>-adapter/<engine>-adapter.service.ts`
   implementing `TemplateService`.
2. Create `<engine>-adapter.module.ts` with `register`/`registerAsync` binding
   `TEMPLATE_PROVIDER` and aliasing `TemplateService` via `useExisting`.
3. Add the engine's file extension to `compilerOptions.assets` in `nest-cli.json`.
4. Pass the module as `adapter:` to `TemplateModule.forRoot` in `src/app.module.ts`.
5. Add `<engine>-adapter.service.unit.spec.ts`.

## Tests

No test exists (finding `G1`). `PugAdapterService` is a plain class — construct
it with a fixture `baseDir`, compile a small fixture template, assert the HTML,
and assert the failure path for a missing file.

## Reuse

Copy `src/templating/` whole; `pug-adapter/` needs `pug` and `@types/pug`.
Nothing here imports from another module of this template. Take
`src/templates/` with it if you want the typed registry, and copy the
`nest-cli.json` asset entry.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`N3`** — `TemplateModule` has no `forRootAsync`, and no
  `validateAdapterModule` guard on any async path.
- **`N7`** — `src/templates/template-renderer.interface.ts` duplicates this
  contract and is dead.
- **`G1`** — no tests.
