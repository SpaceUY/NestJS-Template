# Email — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/email/`.

## Scope

Owns email delivery behind a provider-agnostic contract, with four adapters:
AWS SES, SendGrid, Resend and a console adapter for local development.

Does not own: template rendering. `EmailService` takes **pre-rendered** content.
Compiling a template is `src/templating/`'s job, and the caller wires the two
together: compile with `TemplateService.compile()`, then hand the returned HTML
to `EmailService.sendEmail()` as `content: { html }`. `src/email/README.md`'s
"Recipe: render, then send" section has the worked example. This separation is
deliberate: it is what lets either side be swapped alone.

No controller in the template demonstrates it any more. The demo `GET /email`
route in `src/app.controller.ts` was deleted on `chore/template-hardening`: it
was unguarded and triggered a real send to a hardcoded recipient as soon as a
real adapter was configured. Do not reintroduce an example route that sends;
the README recipe is where the pattern lives now.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `EmailService` | `src/email/abstract/email.service.ts` | `sendEmail`, `sendEmailBatch` — inject this. Also owns `protected logger` and `setLogger()` |
| `EmailAbstractModule` | `src/email/abstract/email-abstract.module.ts` | `forRoot` / `forRootAsync` — both optionally inject `LoggerService` |
| `SendRenderedEmailParams`, `MailingResponse` and siblings | `src/email/abstract/email.interface.ts` | Call and response shapes |
| `RenderedEmailContent` | `src/email/abstract/email.types.ts` | The `{ html }` payload |
| `EmailError`, `EMAIL_ERRORS` | `src/email/abstract/email.error.ts` | Error type and codes |
| `emailScope`, `EmailScopeConfig`, `EMAIL_ADAPTERS` | `src/email/config/email.scope.ts` | Config and the adapter enum |
| `AwsSesAdapterService` | `src/email/aws-ses-adapter/aws-ses-adapter.service.ts` | Named only in `src/app.module.ts` |
| `SendgridAdapterService` | `src/email/sendgrid-adapter/sendgrid-adapter.service.ts` | Named only in `src/app.module.ts` |
| `ResendAdapterService` | `src/email/resend-adapter/resend-adapter.service.ts` | Named only in `src/app.module.ts` |
| `ConsoleAdapterService` | `src/email/console-adapter/console-adapter.service.ts` | Named only in `src/app.module.ts` |
| `MockEmailService` | `src/email/abstract/mocks/` | Test double |

## Internal

`src/email/utils/execute-html-email-send.ts` is an internal helper — not part of
the surface.

## Configuration

`emailScope` reads `EMAIL_ADAPTER` (one of `AWS_SES`, `SENDGRID`, `RESEND`,
`CONSOLE`; defaults to `CONSOLE`), `EMAIL_FROM`, `SENDGRID_API_KEY`,
`RESEND_API_KEY`, `RESEND_EMAIL_FROM`, `AWS_SES_REGION`, `AWS_ACCESS_KEY` and
`AWS_SECRET_ACCESS_KEY`.

Defaulting to `CONSOLE` is intentional: a developer with no credentials gets a
working app that prints emails instead of a boot failure.

**Selecting an adapter selects its requirements.** Each provider's credentials
are `.required()` exactly while that provider is the selected one, and inert
(defaulting to `''`) otherwise, so the other providers' variables may stay
unset. This is the `analytics.scope.ts` pattern (`posthogApiKey` under
`POSTHOG`), applied to all three real adapters:

| `EMAIL_ADAPTER` | Required alongside it |
|---|---|
| `CONSOLE` (default) | nothing at all |
| `SENDGRID` | `EMAIL_FROM`, `SENDGRID_API_KEY` |
| `RESEND` | `EMAIL_FROM`, `RESEND_API_KEY` |
| `AWS_SES` | `EMAIL_FROM`, `AWS_SES_REGION`, `AWS_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY` |

`AwsSesAdapterService` builds its `SESClient` with an explicit `credentials`
object, so it never falls back to the ambient AWS credential chain — all three
of its variables are genuinely mandatory, not merely conventional.

`EMAIL_FROM` has no default. A plausible-looking one (it used to be
`fake@example.com`) is the `C2` shape: a deploy that forgot the variable sends
from the placeholder instead of refusing to start. Under `CONSOLE` the field
validates to `''`, which `ConsoleAdapterService` reads as "no default sender" —
nothing is delivered from it either way, so cloning the template and booting it
with no `.env` still works. `RESEND_EMAIL_FROM` is an optional Resend-only
override and likewise carries no default; its old `''` default was a value this
schema itself rejects, because Joi never validates its own defaults.

Validation runs with `abortEarly: false` and each rule carries a message naming
the **environment variable**, not the config field — Joi's own wording would say
`"sendgridApiKey" is required`, which is not what an operator sets. A
misconfigured `AWS_SES` boot therefore lists all four missing variables at once.
Messages name variables and never echo a value (`T4`).

This validation is deliberately incompatible with a deploy that was already
misconfigured: one that used to start and fail at the first send now refuses to
start and says which variable is missing.

## Rules

1. Inject `EmailService`. Never an adapter class (invariant `T1`).
2. Render first, then send. Compile with `TemplateService` and pass the result as
   `content: { html }`.
3. Adapter selection is the `useFactory` in `src/app.module.ts`, switching on
   `emailScope`'s `adapter` value against the `EMAIL_ADAPTERS` constants, with
   `ConsoleAdapterService` as the fallback branch.
4. Adapters do **not** take or declare a logger. `EmailService` owns a
   `protected logger` that defaults to `new NestLoggerAdapter(<adapter class
   name>)`, and `EmailAbstractModule` optionally injects the container's
   `LoggerService` and calls `setLogger()` on the instance it builds — so the
   module still works with no logger registered. Declaring a `logger` field in
   an adapter shadows the inherited one and silently defeats that injection;
   that is why `ResendAdapterService`, `SendgridAdapterService`,
   `AwsSesAdapterService` and `ConsoleAdapterService` each carry a comment
   saying so. Do not pass `LoggerService` through the `app.module.ts` factory.
   `cloud-storage`, `config-provider` and `queues` use the same pattern.
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

`src/email/utils/execute-html-email-send.unit.spec.ts` covers the send core the
three real adapters share: the refusal when `content.html` is empty, the success
log, and the translation of any provider failure into
`EMAIL_ERRORS.PROVIDER_REJECTED` with the provider text kept as `cause` data
rather than as the message. `console-adapter.service.unit.spec.ts` and
`resend-adapter.service.unit.spec.ts` cover an adapter of each kind on top of
it, and `aws-ses-adapter.service.unit.spec.ts` and
`sendgrid-adapter.service.unit.spec.ts` cover the remaining two: the payload
each builds for its SDK, the sender and subject defaults, the batch call that
must not be the single-send one, and — on every failure path — that neither the
AWS secret nor the SendGrid API key reaches a log line. Adapters are plain
classes — construct with `new`, mock the provider SDK at module level with
`jest.mock`, assert the mapped payload and the thrown `EmailError`.

`aws-ses-adapter/` is the one adapter that does not route through
`executeHtmlEmailSend`: it rethrows the SDK error as-is, so its spec asserts
the raw rejection rather than an `EmailError`.

`src/email/config/email.scope.unit.spec.ts` covers the scope's validator the
way `src/analytics/config/analytics.scope.unit.spec.ts` covers its own: call
`emailScope.validate` directly with a raw record — no Nest container. It asserts
each adapter with its credentials present, each one without them (and that the
message names the missing environment variable), `CONSOLE` with nothing set at
all, the absence of any fallback sender, the rejection of an undeclared key, and
that no credential value reaches the error message.

`src/email/abstract/mocks/email.service.mock.ts` gives `MockEmailService` for
consumers that only need an `EmailService` in their container — every method a
`jest.fn()` with a sane default, the same shape `src/cache/abstract/mocks/` uses.

## Reuse

Copy `src/email/abstract/` plus the adapters you want.

- `abstract/` needs only `@nestjs/common`.
- `aws-ses-adapter/` needs `@aws-sdk/client-ses`; `sendgrid-adapter/` needs
  `@sendgrid/mail`; `resend-adapter/` needs `resend`; `console-adapter/` needs
  nothing.

`src/email/config/email.scope.ts` depends on `src/config-provider/` and `joi`.
Adapters reference `LoggerService` from `src/common/observability/logger/` — port that too, or
drop the optional logger parameter.

`src/email/README.md`'s `## Reuse` is the human version of this section. Keep
the two congruent (`T7`).

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`B1`** — ~~the email factory in `src/app.module.ts` references `emailConfig`,
  `awsConfig` and `ConfigType`, none of which is imported; the app does not
  compile. It should use the already-imported `emailScope`.~~ **Fixed by
  switching the factory to the already-registered `emailScope`.**
- **`D2`** — ~~`src/email/README.md` documents `utils/email-logger.adapter.ts`,
  `abstract/email-logger.interface.ts` and `!src/config/email.config.ts`, none of
  which exist, and still teaches `@nestjs/config`.~~ **Fixed:** the README now
  points at the real `src/email/config/email.scope.ts`, drops the fictional
  logger-adapter/interface and the `@nestjs/config` example, and documents
  `src/email/utils/execute-html-email-send.ts`.
- **`N7`** — ~~`abstract/templates.abstract.ts` is dead code.~~ **Fixed on
  `chore/module-gaps`:** `!src/email/abstract/templates.abstract.ts` is deleted.
  `TemplateService.compile` in `src/templating/` is the only compile contract.
- **`N5`** — ~~no mocks.~~ **Fixed on `chore/module-gaps`:**
  `src/email/abstract/mocks/email.service.mock.ts`.
- **`G1`** — ~~no tests.~~ Partly closed on
  `test/coverage-email-templating-push` (the send helper, the console adapter
  and the resend adapter) and **fully closed on `test/coverage-remaining`:**
  `aws-ses` and `sendgrid` have specs too, so every file in the module with
  behaviour is covered.
