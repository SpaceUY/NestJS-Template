# Email — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/email/`.

## Scope

Owns email delivery behind a provider-agnostic contract, with four adapters:
AWS SES, SendGrid, Resend and a console adapter for local development.

Does not own: template rendering. `EmailService` takes **pre-rendered** content.
Compiling a template is `src/templating/`'s job, and the caller wires the two
together — `src/app.controller.ts` shows the pattern. This separation is
deliberate: it is what lets either side be swapped alone.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `EmailService` | `src/email/abstract/email.service.ts` | `sendEmail`, `sendEmailBatch` — inject this |
| `EmailAbstractModule` | `src/email/abstract/email-abstract.module.ts` | `forRoot` / `forRootAsync` |
| `SendRenderedEmailParams`, `MailingResponse` and siblings | `src/email/abstract/email.interface.ts` | Call and response shapes |
| `RenderedEmailContent` | `src/email/abstract/email.types.ts` | The `{ html }` payload |
| `EmailError`, `EMAIL_ERRORS` | `src/email/abstract/email.error.ts` | Error type and codes |
| `emailScope`, `EmailScopeConfig`, `EMAIL_ADAPTERS` | `src/email/config/email.scope.ts` | Config and the adapter enum |
| `AwsSesAdapterService` | `src/email/aws-ses-adapter/aws-ses-adapter.service.ts` | Named only in `src/app.module.ts` |
| `SendgridAdapterService` | `src/email/sendgrid-adapter/sendgrid-adapter.service.ts` | Named only in `src/app.module.ts` |
| `ResendAdapterService` | `src/email/resend-adapter/resend-adapter.service.ts` | Named only in `src/app.module.ts` |
| `ConsoleAdapterService` | `src/email/console-adapter/console-adapter.service.ts` | Named only in `src/app.module.ts` |

## Internal

`src/email/abstract/templates.abstract.ts` (`EmailTemplateService`) duplicates
`TemplateService.compile` and has no callers (finding `N7`). Do not import it.
`src/email/utils/execute-html-email-send.ts` is an internal helper — not part of
the surface.

## Configuration

`emailScope` reads `EMAIL_ADAPTER` (one of `AWS_SES`, `SENDGRID`, `RESEND`,
`CONSOLE`; defaults to `CONSOLE`), `EMAIL_FROM`, `SENDGRID_API_KEY`,
`RESEND_API_KEY`, `RESEND_EMAIL_FROM`, `AWS_SES_REGION`, `AWS_ACCESS_KEY` and
`AWS_SECRET_ACCESS_KEY`.

Defaulting to `CONSOLE` is intentional: a developer with no credentials gets a
working app that prints emails instead of a boot failure.

## Rules

1. Inject `EmailService`. Never an adapter class (invariant `T1`).
2. Render first, then send. Compile with `TemplateService` and pass the result as
   `content: { html }`.
3. Adapter selection is the `useFactory` in `src/app.module.ts`, switching on
   `emailScope`'s `adapter` value against the `EMAIL_ADAPTERS` constants, with
   `ConsoleAdapterService` as the fallback branch.
4. Adapters accept an optional `logger?: LoggerService` last parameter and fall
   back to `new NestLoggerAdapter(...)` — so the module works with no logger
   registered. `ResendAdapterService` is the reference. Pass the injected logger
   through `inject: [LoggerService]` in the factory when one exists.
5. Adapters throw `EmailError` with an `EMAIL_ERRORS` code. A `@sendgrid/mail`,
   `resend` or `@aws-sdk/client-ses` error must never escape.
6. Never log a recipient address, an API key or message content. Log the outcome
   and a provider message ID.
7. Batch sends go through `sendEmailBatch`, not a loop over `sendEmail`.
8. Template names and subjects come from `src/templates/template.const.ts`. Do
   not inline a subject string at the call site.

## Adding an adapter

1. Create `src/email/<provider>-adapter/<provider>-adapter.service.ts` extending
   `EmailService`.
2. Add `<provider>-adapter-config.interface.ts` for the constructor options.
3. Accept `logger?: LoggerService` as the last constructor parameter with the
   `NestLoggerAdapter` fallback.
4. Translate provider errors into `EmailError`.
5. Add the provider to `EMAIL_ADAPTERS` and the scope's fields in
   `src/email/config/email.scope.ts`.
6. Add a branch to the factory in `src/app.module.ts`.
7. Add `<provider>-adapter.service.unit.spec.ts`.

## Tests

No test exists for this module (finding `G1`). Adapters are plain classes —
construct with `new`, mock the provider SDK at module level with `jest.mock`,
assert the mapped payload and the thrown `EmailError`. `ConsoleAdapterService` is
the easiest place to start. No `abstract/mocks/` exists yet (finding `N5`).

## Reuse

Copy `src/email/abstract/` plus the adapters you want.

- `abstract/` needs only `@nestjs/common`.
- `aws-ses-adapter/` needs `@aws-sdk/client-ses`; `sendgrid-adapter/` needs
  `@sendgrid/mail`; `resend-adapter/` needs `resend`; `console-adapter/` needs
  nothing.

`src/email/config/email.scope.ts` depends on `src/config-provider/` and `joi`.
Adapters reference `LoggerService` from `src/common/observability/logger/` — port that too, or
drop the optional logger parameter.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`B1`** — ~~the email factory in `src/app.module.ts` references `emailConfig`,
  `awsConfig` and `ConfigType`, none of which is imported; the app does not
  compile. It should use the already-imported `emailScope`.~~ **Fixed by
  switching the factory to the already-registered `emailScope`.**
- **`D2`** — `src/email/README.md` documents `utils/email-logger.adapter.ts`,
  `abstract/email-logger.interface.ts` and `!src/config/email.config.ts`, none of
  which exist, and still teaches `@nestjs/config`.
- **`N7`** — `abstract/templates.abstract.ts` is dead code.
- **`N5`**, **`G1`** — no mocks, no tests.
