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
│   ├── email.interface.ts
│   ├── email.service.ts
│   ├── email.types.ts
│   ├── email-error.ts
│   └── email-logger.interface.ts
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
└── utils/
    └── email-logger.adapter.ts
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
import { ConfigType } from '@nestjs/config';
import { EmailAbstractModule } from './email/abstract/email-abstract.module';
import { AwsSesAdapterService } from './email/aws-ses-adapter/aws-ses-adapter.service';
import { SendgridAdapterService } from './email/sendgrid-adapter/sendgrid-adapter.service';
import { ResendAdapterService } from './email/resend-adapter/resend-adapter.service';
import { ConsoleAdapterService } from './email/console-adapter/console-adapter.service';
import { createDefaultEmailLogger } from './email/utils/email-logger.adapter';
import awsConfig from './config/aws.config';
import emailConfig, { EMAIL_ADAPTERS } from './config/email.config';

@Module({
  imports: [
    EmailAbstractModule.forRootAsync({
      inject: [emailConfig.KEY, awsConfig.KEY],
      useFactory: (
        email: ConfigType<typeof emailConfig>,
        aws: ConfigType<typeof awsConfig>,
      ) => {
        const logger = createDefaultEmailLogger();
        const adapter = email.adapter?.toUpperCase();

        if (adapter === EMAIL_ADAPTERS.SENDGRID) {
          return new SendgridAdapterService(
            {
              sendgridApiKey: email.sendgrid.apiKey,
              emailFrom: email.from,
            },
            logger,
          );
        }

        if (adapter === EMAIL_ADAPTERS.RESEND) {
          return new ResendAdapterService(
            {
              resendApiKey: email.resend.apiKey,
              emailFrom: email.resend.emailFrom || email.from,
            },
            logger,
          );
        }

        if (adapter === EMAIL_ADAPTERS.AWS_SES) {
          return new AwsSesAdapterService({
            region: aws.ses.region,
            accessKeyId: aws.ses.accessKeyId,
            secretAccessKey: aws.ses.secretAccessKey,
            fromEmail: aws.ses.from || email.from,
          });
        }

        return new ConsoleAdapterService({
          fromEmail: email.from,
        });
      },
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

## Config

[`src/config/email.config.ts`](../config/email.config.ts) now supports:

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

## Extending with a New Adapter

1. Create a new `*AdapterService` that extends `EmailService`.
2. Add a config interface for constructor params.
3. Instantiate it inside `EmailAbstractModule.forRootAsync(...useFactory...)`.
