# Logging Best Practices

Guidelines for writing consistent, useful logs across the codebase. These apply
regardless of which adapter is configured under `LoggerService`.

---

## Setup

Every service that logs must inject `LoggerService` and call `setContext` in the
constructor:

```ts
import { Injectable } from '@nestjs/common';
import { LoggerService } from './common/logger/abstract/logger.service';

@Injectable()
export class PaymentService {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(PaymentService.name);
  }
}
```

`setContext` binds the class name to every log line emitted by that instance,
making it easy to filter by service in any log aggregator.

---

## Always use structured logs

Pass a `LogInput` object. Never use string interpolation or bare primitives.

```ts
// Correct
this.logger.log({ message: 'Payment processed', data: { paymentId, amount } });

// Wrong
this.logger.log({ message: `Payment processed: ${paymentId}` });
this.logger.log({ message: 'Payment processed' }); // missing useful context
```

Structured logs stay machine-parseable and queryable. Interpolated strings
become opaque blobs the moment they hit a log aggregator.

---

## Choose log levels by signal

| Level   | When to use |
|---------|-------------|
| `log`   | Meaningful business milestones and state transitions (payment confirmed, user registered, job completed). |
| `debug` | Low-level tracing: query details, intermediate values, external request/response bodies. Not emitted in production by default. |
| `warn`  | Recoverable degradation: a retry succeeded, a fallback was used, an optional dependency is unavailable. |
| `error` | True failures that require action or investigation. |

When in doubt: `log` is for things a product engineer would care about; `debug`
is for things a backend engineer needs during an incident.

---

## Keep controllers log-free

Controllers are orchestration only. Request/response logging is the
responsibility of middleware or interceptors — not individual route handlers.
Business logs belong in service and task layers where the actual work happens.

---

## Do not log then re-throw

The global exception filter handles uncaught errors. Adding a `logger.error`
immediately before `throw` produces duplicate log lines with no extra signal.

```ts
// Wrong
this.logger.error({ message: 'Payment failed', data: { reason } });
throw new PaymentException(reason);

// Correct — log only when you need to preserve context the exception won't carry
throw new PaymentException(reason);
```

Exception: log before throwing when the intermediate state (e.g. a partial
result, a correlation ID) won't be present in the thrown exception itself.

---

## Summarise, don't dump

Log counts, IDs, and flags — not full arrays or large objects.

```ts
// Correct
this.logger.log({ message: 'Batch processed', data: { count: items.length, batchId } });

// Wrong — floods logs and obscures signal
this.logger.log({ message: 'Batch processed', data: { items } });
```

---

## Never log sensitive data

Do not include in `data`:

- Passwords or secrets
- API keys or bearer tokens
- Private keys or certificates
- Raw PII (full card numbers, national IDs, etc.)
- Large document payloads

If a value is something you would redact in a bug report, do not log it.

---

## Use `debug` for external call details

Logging the full request/response of an outbound HTTP call or database query is
useful during development and incidents — but noisy in production. Put it at
`debug` level so it disappears unless explicitly enabled.

```ts
this.logger.debug({ message: 'Calling payment provider', data: { endpoint, amount } });
const result = await this.provider.charge(payload);
this.logger.debug({ message: 'Payment provider responded', data: { statusCode: result.status } });
```

---

## One log per logical outcome, not per line of code

Log what happened (outcome), not what you are about to do (intent). A single
`log` at the successful end of an operation is clearer than several `debug`
lines narrating each step.

```ts
// Correct
const order = await this.orders.create(dto);
this.logger.log({ message: 'Order created', data: { orderId: order.id } });

// Wrong — narrates implementation details, not outcomes
this.logger.debug({ message: 'Validating order DTO' });
this.logger.debug({ message: 'Persisting order' });
this.logger.log({ message: 'Order created', data: { orderId: order.id } });
```
