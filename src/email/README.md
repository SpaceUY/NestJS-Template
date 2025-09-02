# Email Module

A NestJS module that provides a modular, provider-agnostic email system with a clean, injectable service interface.

---

## Overview

This module provides a flexible, extensible email solution for NestJS applications. It includes:

- A configurable, provider-agnostic email module
- Abstract service and template service for easy provider swapping
- Type-safe, centralized template management
- Support for providers like Sendgrid, AWS SES, etc.
- Pluggable template engines (e.g., pug)
- Integration with NestJS dependency injection

---

## Features

- Provider-agnostic, modular design
- Easy-to-use service interface for sending emails
- Support for single and multiple recipients
- Type-safe template management
- Pluggable template engines
- Extensible for new providers

---

## Directory Structure

```
src/email/
├── abstract/
│   ├── email.service.ts
│   ├── email.interface.ts
│   ├── templates.abstract.ts
│   ├── email-abstract.module.ts
│   ├── email-provider.const.ts
│   └── email.types.ts
├── sendgrid-adapter/
│   ├── sendgrid-adapter.service.ts
│   ├── sendgrid-adapter.module.ts
│   ├── sendgrid-adapter-config-provider.const.ts
│   └── sendgrid-adapter-config.interface.ts
├── resend-adapter/
│   ├── resend-adapter.service.ts
│   ├── resend-adapter.module.ts
│   ├── resend-adapter-config-provider.const.ts
│   └── resend-adapter-config.interface.ts
```

---

## Installation

Install the required dependencies for your chosen provider. For example, for Sendgrid:

```bash
npm install @sendgrid/mail
```

For Resend:

```bash
npm install resend
```

---

## Usage

### 1. Register the Email Module in your app

#### SendGrid Example

```typescript
@Module({
  imports: [
    EmailAbstractModule.forRoot({
      adapter: SendgridAdapterModule.register({
        sendgridApiKey: process.env.SENDGRID_API_KEY,
        emailFrom: 'noreply@example.com',
      }),
    }),
  ],
})
export class AppModule {}
```

#### Resend Example

```typescript
@Module({
  imports: [
    EmailAbstractModule.forRoot({
      adapter: ResendAdapterModule.register({
        resendApiKey: process.env.RESEND_API_KEY,
        emailFrom: 'noreply@resend.dev',
      }),
    }),
  ],
})
export class AppModule {}
```

### Composing with the Templates Module

Register the templating module alongside the email module. Render first, then send.

```typescript
@Module({
  imports: [
    TemplateModule.forRoot({
      adapter: PugAdapterModule.register({ baseDir: process.cwd() }),
      isGlobal: true,
    }),
    EmailAbstractModule.forRoot({
      adapter: SendgridAdapterModule.register({
        sendgridApiKey: process.env.SENDGRID_API_KEY,
        emailFrom: 'noreply@example.com',
      }),
    }),
  ],
})
export class AppModule {}

// usage
const html = await templateService.compile(TEMPLATE_PATHS[TEMPLATES.WELCOME], { name: 'Alice' });
await emailService.sendEmail({ to: 'user@example.com', subject: 'Welcome!', content: { html } });
```

#### Async Registration Examples

**SendGrid:**
```typescript
EmailAbstractModule.forRoot({
  adapter: SendgridAdapterModule.registerAsync({
    inject: [config.KEY],
    useFactory: (cfg: ConfigType<typeof config>) => ({
      sendgridApiKey: cfg.sendgrid.apiKey,
      emailFrom: cfg.from,
    }),
  }),
})
```

**Resend:**
```typescript
EmailAbstractModule.forRoot({
  adapter: ResendAdapterModule.registerAsync({
    inject: [config.KEY],
    useFactory: (cfg: ConfigType<typeof config>) => ({
      resendApiKey: cfg.resend.apiKey,
      emailFrom: cfg.resend.emailFrom,
    }),
  }),
})
```

### 2. Inject the Email Service

```typescript
constructor(private readonly emailService: EmailService) {}
```

### 3. Send an Email (render separately, then send)

```typescript
// Use your templating module
const html = await templateRenderer.compile(TEMPLATES.WELCOME, { name: 'Alice' });

// Send pre-rendered content
await this.emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  content: { html },
});
```

---

## Adding New Providers

To add support for another email provider (e.g., AWS SES):

1. **Create a New Adapter**
   - Create a new directory, e.g. `ses-adapter/`.
   - Implement a service that extends `EmailService` and implements the required methods.

2. **Define the Adapter Module**
   - Create a module similar to `SendgridAdapterModule` to initialize the new provider.
   - Provide a configuration mechanism (`register` or `registerAsync`).

3. **Register the Adapter in the Abstract Module**
   - Use your new adapter module in `EmailAbstractModule.forRoot({ adapter: ... })`.

4. **Implement Provider-Specific Logic**
   - Ensure your adapter implements `sendEmail` and `sendEmailMultiple` using the provider's SDK.

---

## Contributing

Feel free to submit issues and enhancement requests!

---

## Decoupling Templating from Mailing (Proposed Plan)

### Goals

- Separate concerns so email delivery and template rendering are independent.
- Make adapters consume only raw content (HTML/text or provider template IDs), not a renderer.
- Allow teams to choose any templating solution without changing the mail layer.

### Target Architecture

- Mailing layer (this module):
  - Provides `EmailService` and provider adapters (SendGrid, Resend, etc.).
  - Accepts pre-rendered content only via `content.html` or provider-native `templateId` + `params`.
  - Handles send, batch, errors, and logging.
- Templating layer (separate module):
  - Exposes a `TemplateRenderer` service (e.g., pug, handlebars, react-email) with `compile(nameOrPath, params)`.
  - Owns template registries, subjects, and type-safe param maps.
  - Is optional and can be swapped independently.

### API Changes (Mailing)

- `EmailService`
  - Remove `renderTemplate(...)` from the mailing service API.
  - Keep: `sendEmail(params)` and `sendEmailBatch(params)` where `params.content` is already rendered (or contains provider `templateId`).
- `EmailAbstractModule`
  - Stop wiring a template provider. Only wire the mail adapter and expose `EmailService`.
- Types
  - Keep `RenderedEmailContent` but clarify it is delivery-ready input.
  - Keep `templateId` + `params` usage for providers that natively support it (e.g., SendGrid).

### API (Templating) – New Module

- Introduce `TemplateRenderer` interface:
  - `compile(nameOrPath: string, params: Record<string, unknown>): Promise<string>`
- Provide an implementation package (e.g., `PugTemplateModule`).
- Keep template constants, subjects, and param maps in the templating module.

### Migration Plan

1. Create a new `templates/` module with `TemplateRenderer` and an initial renderer (pug).
2. Move `templates.abstract.ts`, template constants, and param map types into the templating module.
3. Deprecate `EmailService.renderTemplate(...)` for one minor version; log a deprecation warning if used.
4. Update `EmailAbstractModule` to no longer inject a template service.
5. Update adapters (SendGrid/Resend): no changes needed for sends; they already accept raw HTML or `templateId`.
6. Update app usage:
   - Render with the templating module, then call `emailService.sendEmail({ content: { html } })`.
7. Remove the deprecated `renderTemplate(...)` in the next major version.

### Usage After Decoupling

```typescript
// 1) Render template using the templating module
const html = await templateRenderer.compile(TEMPLATES.WELCOME, { name: 'Alice' });

// 2) Send using the mailing module (raw content)
await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  content: { html },
});
```

### 4. Logging

The email adapters log using a default Nest `Logger` adapted to a standard shape. You can customize logs by providing your own `EMAIL_LOGGER`.

Default behavior:
- SendGrid/Resend modules register `EMAIL_LOGGER` using `new Logger('EmailModule')`.
- Adapters log:
  - debug: before sending (single and batch)
  - info: on success (status code, counts)
  - error: on failure (wrapped by `EmailError`)

Override with a custom logger:

```typescript
import { Module, Logger } from '@nestjs/common';
import { EmailAbstractModule } from './email/abstract/email-abstract.module';
import { SendgridAdapterModule } from './email/sendgrid-adapter/sendgrid-adapter.module';
import { EMAIL_LOGGER } from './email/abstract/email-logger.interface';
import { adaptLogger } from './email/logger/standard-logger.interface';

@Module({
  imports: [
    EmailAbstractModule.forRoot({
      adapter: SendgridAdapterModule.register({
        sendgridApiKey: process.env.SENDGRID_API_KEY!,
        emailFrom: 'noreply@example.com',
      }),
    }),
  ],
  providers: [
    Logger,
    {
      provide: EMAIL_LOGGER,
      inject: [Logger],
      useFactory: (nestLogger: Logger) => {
        const std = adaptLogger(nestLogger);
        std.setContext('Email');
        return {
          debug: (message: string, meta?: Record<string, unknown>) =>
            std.debug({ message, data: meta }),
          info: (message: string, meta?: Record<string, unknown>) =>
            std.info({ message, data: meta }),
          warn: (message: string, meta?: Record<string, unknown>) =>
            std.warn({ message, data: meta }),
          error: (message: string, meta?: Record<string, unknown>) =>
            std.error({ message, data: meta }),
        };
      },
    },
  ],
})
export class AppModule {}
```

### Notes by Provider

- SendGrid: supports `templateId` + `dynamicTemplateData` natively. You may bypass HTML rendering entirely by passing `{ content: { templateId, params } }`.
- Resend: does not support `templateId`; use raw `html` or React components in your own templating module.

### Error Handling & Logging

- Keep `EmailError` for mail delivery concerns (auth, quota, provider rejects, etc.).
- Templating failures should throw their own templating errors within the templating module.
- Logger remains pluggable in the mailing layer; templating module can define its own logger contract.

### Semver & Timeline

- Minor version: introduce templating module and deprecate `renderTemplate(...)` with warnings.
- Major version: remove `renderTemplate(...)` from the mailing service and `templateService` wiring from the email module.