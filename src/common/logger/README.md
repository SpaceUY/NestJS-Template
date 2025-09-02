# Common Logger

Shared, provider-agnostic logging helpers you can reuse across modules.

---

## StandardLogger (shape) and adapters

- File: `standard-logger.interface.ts`
  - `StandardLogger` interface: `{ setContext, info, error, warn, debug }`
  - `adaptLogger(logger: Logger)` converts Nest's `Logger` to `StandardLogger`
  - `formatLogMessage(input)` utility

### Example
```ts
import { Logger } from '@nestjs/common';
import { adaptLogger } from './standard-logger.interface';

const std = adaptLogger(new Logger('MyFeature'));
std.info({ message: 'Started', data: { version: 1 } });
```

---

## LevelLogger (generic level-based facade)

- File: `adapters/level-logger.adapter.ts`
  - `LevelLogger` interface: `{ debug, info, warn, error }`
  - `createLevelLogger(context?: string)` builds a level logger from Nest `Logger`

### Example
```ts
import { createLevelLogger } from './adapters/level-logger.adapter';

const log = createLevelLogger('Payments');
log.info?.('Processing charge', { amount: 100 });
log.error?.('Charge failed', { code: 'DECLINED' });
```

---

## CommonLoggerModule

- File: `logger.module.ts`
  - `CommonLoggerModule.forRoot(context?: string)` provides `STANDARD_LOGGER`

### Example
```ts
import { Module } from '@nestjs/common';
import { CommonLoggerModule, STANDARD_LOGGER } from './common/logger/logger.module';

@Module({
  imports: [CommonLoggerModule.forRoot('MyApp')],
})
export class AppModule {}
```

---

## Overriding module-specific loggers

Modules (e.g., email) may define their own logger shapes. Prefer composing them over the common LevelLogger:

```ts
import { createLevelLogger } from './common/logger/adapters/level-logger.adapter';

export function createEmailLogger() {
  const lvl = createLevelLogger('EmailModule');
  return {
    debug: lvl.debug?.bind(lvl),
    info: lvl.info?.bind(lvl),
    warn: lvl.warn?.bind(lvl),
    error: lvl.error?.bind(lvl),
  };
}
```

---

## Notes
- Keep module-agnostic pieces here; thin module-specific wrappers can live in their respective feature folders or also be centralized if widely reused.
