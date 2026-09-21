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

[`src/email/config/email.scope.ts`](./config/email.scope.ts) supports:

- `EMAIL_ADAPTER`: `AWS_SES | SENDGRID | RESEND | CONSOLE`
- `EMAIL_FROM`
- `SENDGRID_API_KEY`
- `RESEND_API_KEY`
- `RESEND_EMAIL_FROM`

If `EMAIL_ADAPTER` is not provided, it defaults to `CONSOLE`.

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

**Removing it from the template instead.** `src/app.controller.ts` imports
`EmailService` and `emailScope` for its demo route — that is the only inbound
edge outside `src/app.module.ts`, and deleting the demo route clears it.
