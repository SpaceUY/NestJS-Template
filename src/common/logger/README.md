# Logger Module

Provider-agnostic structured logging with an adapter architecture.

Consumers depend only on `LoggerService` (the abstract class). The concrete
adapter — NestJS built-in, Pino, Winston, or a custom one — is wired at module
registration time and is invisible to the rest of the codebase.

---

## Core Contract

[`LoggerService`](./abstract/logger.service.ts) is the only type other modules
should import:

```ts
abstract class LoggerService {
  setContext(context: string): void;
  log(input: LogInput): void;
  warn(input: LogInput): void;
  error(input: LogInput): void;
  debug(input: LogInput): void;
}
```

`LogInput`:

```ts
interface LogInput {
  message: string;
  data?: Record<string, unknown>;
}
```

---

## Directory Structure

```
src/common/logger/
├── abstract/
│   ├── logger-abstract.module.ts      ← forRoot / forRootAsync
│   ├── logger.service.ts              ← abstract class (the DI token)
│   └── logger.interfaces.ts           ← LogInput, LogTelemetryHook
├── nest-adapter/
│   └── nest-logger.adapter.ts         ← wraps NestJS Logger (zero extra deps)
├── pino-adapter/
│   ├── pino-logger.adapter.ts         ← wraps pino directly (peer dep: pino)
│   └── configs/
│       ├── json-logs.config.ts        ← structured JSON preset (production)
│       └── pretty-logs.config.ts      ← colourised preset (local dev, needs pino-pretty)
├── winston-adapter/
│   └── winston-logger.adapter.ts      ← wraps winston directly (peer dep: winston)
├── pino-http/                         ← nestjs-pino bootstrap presets (not part of the adapter model)
│   ├── json-logs.config.ts
│   └── pretty-logs.config.ts
└── README.md
```

---

## Registration

### 1) `forRoot` — no runtime config needed

```ts
import { LoggerAbstractModule } from '@/common/logger/abstract/logger-abstract.module';
import { NestLoggerAdapter } from '@/common/logger/nest-adapter/nest-logger.adapter';

LoggerAbstractModule.forRoot({
  adapter: NestLoggerAdapter,
  isGlobal: true,
})
```

### 2) `forRootAsync` — config-driven instantiation

```ts
import { LoggerAbstractModule } from '@/common/logger/abstract/logger-abstract.module';
import { PinoLoggerAdapter } from '@/common/logger/pino-adapter/pino-logger.adapter';

LoggerAbstractModule.forRootAsync({
  isGlobal: true,
  inject: [appConfig.KEY],
  useFactory: (config: ConfigType<typeof appConfig>) =>
    new PinoLoggerAdapter(config.appName),
})
```

---

## Recipe: wiring the logger in `AppModule`

The recommended default is registering `NestLoggerAdapter` globally. It wraps
NestJS's built-in `Logger`, so whatever logger is configured on the NestJS
application instance is what actually handles the output.

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { LoggerAbstractModule } from './common/logger/abstract/logger-abstract.module';
import { NestLoggerAdapter } from './common/logger/nest-adapter/nest-logger.adapter';

@Module({
  imports: [
    LoggerAbstractModule.forRoot({
      adapter: NestLoggerAdapter,
      isGlobal: true,
    }),
    // ... other modules
  ],
})
export class AppModule {}
```

This means you can swap the underlying logging library by configuring it once
at the NestJS application level — without touching `AppModule` or any consumer.
For example, to use Pino as the underlying engine via
[`nestjs-pino`](https://github.com/iamolegga/nestjs-pino):

```ts
// app.module.ts — add LoggerModule alongside LoggerAbstractModule
import { LoggerModule } from 'nestjs-pino';
import { prettyLogsConfig } from './common/logger/pino-http/pretty-logs.config';
import { jsonLogsConfig } from './common/logger/pino-http/json-logs.config';

const isLocal = process.env.NODE_ENV === 'local';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: isLocal
        ? prettyLogsConfig('debug')
        : jsonLogsConfig('info'),
    }),
    LoggerAbstractModule.forRoot({
      adapter: NestLoggerAdapter,
      isGlobal: true,
    }),
    // ...
  ],
})
export class AppModule {}
```

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.listen(3000);
}
bootstrap();
```

`NestLoggerAdapter` (and every service injecting `LoggerService`) continues to
work identically — the Pino engine is invisible to application code.

Two pre-built `nestjs-pino` config presets live in `pino-http/`:

- **`prettyLogsConfig(logLevel)`** — colourised, human-readable output for
  local development. Requires `pino-pretty` (`pnpm add -D pino-pretty`).
- **`jsonLogsConfig(logLevel)`** — structured JSON output for remote
  environments, stripping `req`/`res` and normalising level labels.

Both require `nestjs-pino` to be installed (`pnpm add nestjs-pino pino`).

The other adapters (`PinoLoggerAdapter`, `WinstonLoggerAdapter`) exist for
cases where you want to drive a logging library **directly**, bypassing
NestJS's logger pipeline entirely.

---

## Consuming `LoggerService`

Inject `LoggerService` anywhere in your application:

```ts
import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/common/logger/abstract/logger.service';

@Injectable()
export class SomeService {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(SomeService.name);
  }

  doSomething(): void {
    this.logger.log({ message: 'Action taken', data: { key: 'value' } });
  }
}
```

---

## Telemetry Hook (future integration point)

Both `forRoot` and `forRootAsync` accept an optional `telemetryHook`. It is
called after every log write with the level, the original `LogInput`, and the
current context string — without any adapter knowing about telemetry internals.

```ts
LoggerAbstractModule.forRoot({
  adapter: NestLoggerAdapter,
  isGlobal: true,
  telemetryHook: (level, input, context) => {
    openTelemetrySpan.addEvent(input.message, { level, context, ...input.data });
  },
})
```

When you are ready to integrate a telemetry provider (OpenTelemetry, Datadog,
etc.), pass the hook here. No adapter code changes are required.

---

## Built-in Adapters

### `NestLoggerAdapter`

Wraps NestJS's built-in `Logger`. No extra dependencies. Recommended default
for projects that haven't chosen a logging library yet.

### `PinoLoggerAdapter`

Wraps [pino](https://github.com/pinojs/pino) directly — no NestJS logger
pipeline involved. Use this when you want pino as a standalone logger, bypassing
`nestjs-pino` entirely.

Pino is a **peer dependency** — install it separately:

```
pnpm add pino
pnpm add -D @types/pino
```

The constructor accepts an optional pino options object. Two presets are
provided in `pino-adapter/configs/`:

```ts
import { PinoLoggerAdapter } from './pino-adapter/pino-logger.adapter';
import { prettyLogsConfig } from './pino-adapter/configs/pretty-logs.config';
import { jsonLogsConfig } from './pino-adapter/configs/json-logs.config';

const isLocal = process.env.NODE_ENV === 'local';

LoggerAbstractModule.forRoot({
  adapter: ..., // can't use forRoot here — use forRootAsync
})

// With forRootAsync:
LoggerAbstractModule.forRootAsync({
  isGlobal: true,
  useFactory: () =>
    new PinoLoggerAdapter(
      'App',
      isLocal ? prettyLogsConfig('debug') : jsonLogsConfig('info'),
    ),
})
```

`pretty-logs.config.ts` requires `pino-pretty` (`pnpm add -D pino-pretty`).

### `WinstonLoggerAdapter`

Wraps [winston](https://github.com/winstonjs/winston). Winston is a **peer
dependency** — install it separately:

```
pnpm add winston
```

---

## Adding a Custom Adapter

1. Create a class that extends `LoggerService`.
2. Implement `setContext`, `log`, `warn`, `error`, `debug`.
3. Call `this.telemetryHook?.(level, input, context)` at the end of each method
   so the hook fires automatically when wired.
4. Register it with `LoggerAbstractModule.forRoot` or `forRootAsync`.
