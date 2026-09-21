# Templates (assets) — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded). Read it first — this file
> adds only what is specific to `src/templates/`.

## Scope

Owns the template files themselves and the typed registry naming them: paths,
subjects and per-template parameter types.

Does not own: anything executable. **There is no Nest module, provider or
service in this directory, and none may be added.** Compilation lives in
`src/templating/` — see `src/templating/CLAUDE.md`.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `TEMPLATES`, `TEMPLATE_PATHS`, `TEMPLATE_SUBJECTS` | `src/templates/template.const.ts` | The registry — the single source of truth |
| `Template`, `TemplateParamsMap` | `src/templates/template-params.interface.ts` | Template union and parameter type map |
| `WelcomeParams` | `src/templates/onboarding/welcome.interface.ts` | Parameters for the welcome template |
| `VerificationParams` | `src/templates/auth/verification.interface.ts` | Parameters for the verification template |
| barrel | `src/templates/index.ts` | Re-exports the registry and the param types |

## Rules

1. A template is three files in a subdirectory named for its domain:
   `<name>.pug`, `<name>.interface.ts` exporting its params type, and entries in
   the registry.
2. Every new template gets an entry in all three registry maps — `TEMPLATES`,
   `TEMPLATE_PATHS`, `TEMPLATE_SUBJECTS` — plus a line in `TemplateParamsMap`.
   All four, or the type map silently drifts from the path map.
3. Paths in `TEMPLATE_PATHS` are repo-relative (`src/templates/...`) because the
   pug adapter's `baseDir` defaults to the process working directory. Changing
   one requires changing the other.
4. Subjects live in `TEMPLATE_SUBJECTS`, never inline at the call site.
5. Templates render data that is already safe. Escape by default; a raw
   interpolation of user-supplied content is an XSS bug in an email client.
6. `nest-cli.json` copies `**/*.pug` into `dist`. A template in another format
   will not ship until that list includes its extension.

## Tests

`src/templates/template.const.unit.spec.ts` checks the registry's internal
consistency, which is the only thing here that can drift: every key of
`TEMPLATES` has an entry in `TEMPLATE_PATHS` and `TEMPLATE_SUBJECTS`, every path
resolves to a file on disk and stays repo-relative, and every subject is
non-empty. Rule 2 says the three maps are edited together; this is what notices
when they are not.

## Reuse

Copy `src/templates/` whole, or take `template.const.ts` and
`template-params.interface.ts` as the pattern and supply your own templates. The
directory depends on nothing — no NestJS import, no runtime dependency.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`N7`** — ~~`template-renderer.interface.ts` is dead code duplicating
  `TemplateService`.~~ **Fixed on `chore/module-gaps`:**
  `!src/templates/template-renderer.interface.ts` is deleted.
- **`G1`** — ~~no registry-consistency test.~~ **Fixed on
  `test/coverage-email-templating-push`:** `template.const.unit.spec.ts`.
