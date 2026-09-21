# Email Module

Provider-agnostic email delivery for NestJS using adapter **services**.

## What Changed

- Adapter modules were removed.
- Adapters are plain services (`*AdapterService`).
- `EmailAbstractModule` now supports:
  - `forRoot({ adapter })` for direct class binding
  - `forRootAsync({ useFactory })` for runtime adapter selection (recommended)
- Added `ConsoleAdapterService` for local/dev logging.

## Directory Structure

```text
src/email/
├── abstract/
│   ├── email-abstract.module.ts
│   ├── email.error.ts
│   ├── email.interface.ts
│   ├── email.service.ts
│   └── email.types.ts
├── aws-ses-adapter/
│   ├── aws-ses-adapter-config.interface.ts
│   └── aws-ses-adapter.service.ts
├── sendgrid-adapter/
│   ├── sendgrid-adapter-config.interface.ts
│   └── sendgrid-adapter.service.ts
├── resend-adapter/
│   ├── resend-adapter-config.interface.ts
│   └── resend-adapter.service.ts
├── console-adapter/
│   ├── console-adapter-config.interface.ts
│   └── console-adapter.service.ts
├── config/
│   └── email.scope.ts
└── utils/
    └── execute-html-email-send.ts
```

## Core Contract

All adapters implement [`EmailService`](./abstract/email.service.ts):

- `sendEmail(params)`
- `sendEmailBatch(params)`

Both methods receive pre-rendered content through [`RenderedEmailContent`](./abstract/email.interface.ts).

## Registration

### `forRoot`

Use this when the adapter can be bound directly as a class.

```ts
EmailAbstractModule.forRoot({
  adapter: ConsoleAdapterService,
  isGlobal: true,
});
```

### `forRootAsync` (Recommended)

Use this when adapter selection depends on runtime config.

```ts
EmailAbstractModule.forRootAsync({
  imports?: [],
  inject?: [],
  useFactory: (...deps) => EmailService | Promise<EmailService>,
  isGlobal?: boolean,
});
```

## Recipe: Dynamic Adapter Selection with `forRootAsync`

This is the recommended pattern for reusable templates.

```ts
import { Module } from '@nestjs/common';
import { EmailAbstractModule } from './email/abstract/email-abstract.module';
import { AwsSesAdapterService } from './email/aws-ses-adapter/aws-ses-adapter.service';
import { SendgridAdapterService } from './email/sendgrid-adapter/sendgrid-adapter.service';
import { ResendAdapterService } from './email/resend-adapter/resend-adapter.service';
import { ConsoleAdapterService } from './email/console-adapter/console-adapter.service';
import {
  emailScope,
  EmailScopeConfig,
  EMAIL_ADAPTERS,
} from './email/config/email.scope';

@Module({
  imports: [
    EmailAbstractModule.forRootAsync({
      // No LoggerService here: EmailAbstractModule injects it itself
      // (optionally) and calls setLogger() on whatever the factory returns.
      inject: [emailScope.KEY],
      useFactory: (email: EmailScopeConfig) => {
        const configuredAdapter = email.adapter?.toUpperCase();

        if (configuredAdapter === EMAIL_ADAPTERS.SENDGRID) {
          return new SendgridAdapterService({
            sendgridApiKey: email.sendgridApiKey,
            emailFrom: email.from,
          });
        }

        if (configuredAdapter === EMAIL_ADAPTERS.RESEND) {
          return new ResendAdapterService({
            resendApiKey: email.resendApiKey,
            emailFrom: email.resendEmailFrom || email.from,
          });
        }

        if (configuredAdapter === EMAIL_ADAPTERS.AWS_SES) {
          return new AwsSesAdapterService({
            region: email.sesRegion,
            accessKeyId: email.sesAccessKeyId,
            secretAccessKey: email.sesSecretAccessKey,
            fromEmail: email.from,
          });
        }

        return new ConsoleAdapterService({ fromEmail: email.from });
      },
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

## Config

[`src/email/config/email.scope.ts`](./config/email.scope.ts) reads:

| Variable | Meaning |
|---|---|
| `EMAIL_ADAPTER` | `AWS_SES \| SENDGRID \| RESEND \| CONSOLE`. Defaults to `CONSOLE`. |
| `EMAIL_FROM` | The sender address handed to the provider. |
| `SENDGRID_API_KEY` | SendGrid credential. |
| `RESEND_API_KEY` | Resend credential. |
| `RESEND_EMAIL_FROM` | Optional Resend-only override of `EMAIL_FROM`. |
| `AWS_SES_REGION` | SES region. |
| `AWS_ACCESS_KEY` | SES access key id (shared with the S3 scope). |
| `AWS_SECRET_ACCESS_KEY` | SES secret access key (shared with the S3 scope). |

### Picking an adapter picks its requirements

Choosing a provider makes that provider's variables mandatory. The app refuses
to boot without them and the error names the variable you are missing — it no
longer starts and then fails at the first send:

| `EMAIL_ADAPTER` | Also required |
|---|---|
| `CONSOLE` (default) | nothing |
| `SENDGRID` | `EMAIL_FROM`, `SENDGRID_API_KEY` |
| `RESEND` | `EMAIL_FROM`, `RESEND_API_KEY` |
| `AWS_SES` | `EMAIL_FROM`, `AWS_SES_REGION`, `AWS_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY` |

The other providers' variables may stay unset or empty while they are not
selected. Everything is reported at once, so a bare `EMAIL_ADAPTER=AWS_SES`
tells you about all four in a single message.

`CONSOLE` stays the frictionless local path: clone, install, start — no
provider variable and not even `EMAIL_FROM`, because that adapter prints the
message to the log instead of delivering it. `EMAIL_FROM` has no default
precisely so a forgotten one cannot become a plausible production sender;
under `CONSOLE` it simply stays empty and `ConsoleAdapterService` logs the
message with no default sender.

**Upgrading an existing deployment.** This is a deliberate breaking change. If
your environment sets `EMAIL_ADAPTER` to a real provider, make sure that
provider's credential and `EMAIL_FROM` are set before you deploy, or the app
will not start.

## Sending Emails

```ts
constructor(private readonly emailService: EmailService) {}

await this.emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome',
  content: {
    html: '<h1>Hello</h1>',
  },
});
```

## Recipe: render, then send

`EmailService` never renders. Compiling a template belongs to
[`src/templating/`](../templating/README.md), and the caller joins the two
halves: `TemplateService.compile()` returns the HTML string, and that string
goes into `sendEmail` as `content: { html }`. Keeping the two apart is what
lets you swap the mail provider without touching templates, and swap the
template engine without touching delivery.

Address the template through `TEMPLATE_PATHS` and its subject through
`TEMPLATE_SUBJECTS`, both from
[`src/templates/template.const.ts`](../templates/template.const.ts) — never a
hand-written path or an inlined subject string.

```ts
import { Inject, Injectable } from '@nestjs/common';
import { EmailService } from './email/abstract/email.service';
import { emailScope, EmailScopeConfig } from './email/config/email.scope';
import { TemplateService } from './templating/abstract/template.service';
import {
  TEMPLATES,
  TEMPLATE_PATHS,
  TEMPLATE_SUBJECTS,
} from './templates/template.const';

@Injectable()
export class WelcomeMailer {
  constructor(
    private readonly templateService: TemplateService,
    private readonly emailService: EmailService,
    @Inject(emailScope.KEY)
    private readonly emailConf: EmailScopeConfig,
  ) {}

  async sendWelcome(to: string, name: string): Promise<void> {
    // 1. Templating renders. It knows nothing about email.
    const html = await this.templateService.compile(
      TEMPLATE_PATHS[TEMPLATES.WELCOME],
      { name },
    );

    // 2. Email delivers pre-rendered content. It knows nothing about pug.
    await this.emailService.sendEmail({
      to,
      from: this.emailConf.from,
      subject: TEMPLATE_SUBJECTS[TEMPLATES.WELCOME],
      content: { html },
    });
  }
}
```

Both services are injected as their abstract classes, and both are registered
globally in `src/app.module.ts`, so a feature module needs no extra imports.
`from` is optional — every adapter falls back to its configured sender — but
passing `emailConf.from` keeps the sender in one place.

The template used to ship a live demonstration of this at `GET /email` in
`src/app.controller.ts`. It was deleted: the route had no guard and sent a real
email to a hardcoded address the moment a non-console adapter was configured.
This recipe replaces it. If you want to try a send by hand, do it from a script
or a guarded route of your own, not from an open endpoint.

## Sending Helper (`executeHtmlEmailSend`)

[`src/email/utils/execute-html-email-send.ts`](./utils/execute-html-email-send.ts)
is a shared helper used by `ResendAdapterService` and `SendgridAdapterService`'s
`sendEmail`/`sendEmailBatch` methods. Given the rendered content, a `send`
function that calls the provider SDK and a `toMailingResponse` mapper, it:

- throws `EmailError` (`EMAIL_ERRORS.INVALID_PARAMS`) if `content.html` is empty
- calls `send`, logs the outcome, and maps the result with `toMailingResponse`
- on a thrown provider error, logs it and rethrows `EmailError`
  (`EMAIL_ERRORS.PROVIDER_REJECTED`) so no provider SDK error escapes the adapter

`AwsSesAdapterService` and `ConsoleAdapterService` do not use it.

## Extending with a New Adapter

1. Create a new `*AdapterService` that extends `EmailService`.
2. Add a config interface for constructor params.
3. Instantiate it inside `EmailAbstractModule.forRootAsync(...useFactory...)`.

## Reuse

**Two supported workflows.** Clone the template whole, or lift only the modules
you need — this one is written for both. What follows is the second case: what
`src/email/` needs in order to compile in another project.

**What travels with it.** Copy `src/email/abstract/` plus the adapters you
want, then bring:

- `src/common/observability/logger/` — `abstract/email.service.ts`, the abstract
  module, the mock and `utils/execute-html-email-send.ts` all reference
  `LoggerService`.
- `src/config-provider/abstract/` — only if you take `config/email.scope.ts`.

**Peer dependencies.**

```bash
pnpm add @aws-sdk/client-ses    # aws-ses-adapter/
pnpm add @sendgrid/mail         # sendgrid-adapter/
pnpm add resend                 # resend-adapter/
pnpm add joi                    # config/email.scope.ts
```

`abstract/` and `console-adapter/` need only `@nestjs/common`.

**Removing it from the template instead.** Nothing outside `src/app.module.ts`
imports this module any more: the demo route in `src/app.controller.ts` that
used to inject `EmailService` and `emailScope` is gone. Drop the
`EmailAbstractModule.forRootAsync(...)` registration and the `emailScope` entry
in `src/app.module.ts`, delete `src/email/`, and the tree still compiles.
