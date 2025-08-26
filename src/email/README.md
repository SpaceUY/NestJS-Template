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
│   ├── template-provider.const.ts
│   └── email.types.ts
├── sendgrid-adapter/
│   ├── sendgrid-adapter.service.ts
│   ├── sendgrid-adapter.module.ts
│   ├── sendgrid-adapter-config-provider.const.ts
│   └── sendgrid-adapter-config.interface.ts
├── aws-ses-adapter/
│   ├── aws-ses-adapter.service.ts
│   ├── aws-ses-adapter.module.ts
│   ├── aws-ses-adapter-config-provider.const.ts
│   └── aws-ses-adapter-config.interface.ts
```

---

## Installation

Install the required dependencies for your chosen provider and template engine. For example, for Sendgrid and pug:

```bash
npm install @sendgrid/mail pug
```

---

## Usage

### 1. Register the Email Module in your app

```typescript
@Module({
  imports: [
    EmailAbstractModule.forRoot({
      adapter: SendgridAdapterModule.register({
        sendgridApiKey: process.env.SENDGRID_API_KEY,
        emailFrom: 'noreply@example.com',
      }),
      templateService: PugCompilerModule, // or your template engine
    }),
  ],
})
export class AppModule {}
```

#### Async Registration Example

```typescript
EmailAbstractModule.forRoot({
  adapter: SendgridAdapterModule.registerAsync({
    inject: [config.KEY],
    useFactory: (cfg: ConfigType<typeof config>) => ({
      sendgridApiKey: cfg.sendgridApiKey,
      emailFrom: cfg.emailFrom,
    }),
  }),
  templateService: PugCompilerModule,
})
```

### 2. Inject the Email Service

```typescript
constructor(private readonly emailService: EmailService) {}
```

### 3. Send an Email

```typescript
await this.emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  content: {
    html: '<b>Hello!</b>',
  },
});
```

---

## Template Management

Templates are managed in a type-safe, centralized way:

- **Template Constants and Paths**
  ```typescript
  export const TEMPLATES = {
    WELCOME: "WELCOME",
    VERIFICATION: "VERIFICATION",
  } as const;

  export const TEMPLATE_PATHS = {
    [TEMPLATES.WELCOME]: "src/templates/onboarding/welcome.pug",
    [TEMPLATES.VERIFICATION]: "src/templates/auth/verification.pug",
  } as const;
  ```

- **Template Parameter Types**
  ```typescript
  export interface TemplateParamsMap {
    [TEMPLATES.WELCOME]: WelcomeParams;
    [TEMPLATES.VERIFICATION]: VerificationParams;
  }
  ```

- **Example Template Params**
  ```typescript
  // onboarding/welcome.interface.ts
  export interface WelcomeParams { name: string; }

  // auth/verification.interface.ts
  export interface VerificationParams { name: string; verificationUrl: string; }
  ```

- **Rendering a Template**
  ```typescript
  const rendered = await emailService.renderTemplate({
    name: TEMPLATES.WELCOME,
    params: { name: "Alice" },
  });
  ```

- **Adding a New Template**
  1. Add your `.pug` file in the appropriate directory.
  2. Add a new entry to `TEMPLATES`, `TEMPLATE_PATHS`, and `TEMPLATE_SUBJECTS`.
  3. Define the params interface and add it to `TemplateParamsMap`.

---

## Pug Compiler Module

The `pug-compiler` module provides a concrete implementation of the `EmailTemplateService` using the [pug](https://pugjs.org/) templating engine. It is responsible for compiling `.pug` template files with the provided context.

### Structure

- **Module:**
  ```typescript
  @Module({
    providers: [
      {
        provide: EMAIL_TEMPLATE_SERVICE,
        useClass: PugCompilerService,
      },
      {
        provide: EmailTemplateService,
        useExisting: EMAIL_TEMPLATE_SERVICE,
      },
    ],
    exports: [EMAIL_TEMPLATE_SERVICE, EmailTemplateService],
  })
  export class PugCompilerModule {}
  ```

- **Service:**
  ```typescript
  @Injectable()
  export class PugCompilerService implements EmailTemplateService {
    async compile(templatePath: string, context: any): Promise<string> {
      // Compiles the .pug file at the given path with the provided context
    }
  }
  ```

### Usage

To use the pug-compiler in your email system, register it as the template service in your email module setup:

```typescript
@Module({
  imports: [
    EmailAbstractModule.forRoot({
      adapter: SendgridAdapterModule.register({
        sendgridApiKey: process.env.SENDGRID_API_KEY,
        emailFrom: 'noreply@example.com',
      }),
      templateService: PugCompilerModule,
    }),
  ],
})
export class AppModule {}
```

When you call `emailService.renderTemplate(...)`, the system will use the `PugCompilerService` to render the specified `.pug` template with the given parameters.

---

## AWS SES Integration

Assuming that a `awsConfig` is registered using `@nestjs/common`'s `registerAs` method. 


For a secure and scalable integration with AWS SES, it is recommended to **use IAM Roles instead of passing access keys explicitly**.  
For this reason, the environment variables **AWS_ACCESS_KEY** and **AWS_SECRET_ACCESS_KEY** are optional in this project.

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

## Best Practices

1. **Message Formatting & Consistency**
   - Use a consistent payload structure for all emails.
   - Include clear subjects and concise messages.
   - Use localization for multi-language support.

2. **Error Handling & Retry Mechanism**
   - Log all email requests and responses.
   - Implement retry logic for failed emails (consider exponential backoff).
   - Store failed emails for future reprocessing if needed.

3. **Security & Privacy**
   - Use authentication when managing email sending.
   - Do not expose sensitive data in logs or client-side code.
   - Encrypt sensitive data in the email payload if necessary.

4. **Performance & Scalability**
   - Send emails in batches when possible.
   - Use asynchronous processing for large-scale email sending.
   - Monitor response times and delivery rates.

---

## Contributing

Feel free to submit issues and enhancement requests!