# Queues — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/queues/`.

## Scope

Owns a provider-agnostic **sender** and **consumer** abstraction for message
queues, plus the BullMQ, RabbitMQ and SQS adapters behind them. Unlike the
single-abstract-class shape most modules use, queues are bidirectional, so
the contract is split in two: `QueueSenderService` (publish) and
`QueueConsumerAdapter`/`QueueConsumerHandler` (consume). BullMQ is the only
adapter wired by default (`src/queues/queues.module.ts`); RabbitMQ and SQS
ship complete but unwired — see "Known gaps".

Does not own: a queue's job payload shape or the business logic that runs
when a message is handled — that's `QueueConsumerHandler` subclasses living
with the domain module (e.g. `src/spaceship/notification/`). `src/queues/`
must stay liftable into another project on its own; a domain handler
*living* here would break that — see "Rules" for the one place this module
still has to name one.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `QueueSenderService` | `abstract/sender/queue-sender.service.ts` | Abstract contract/DI token: `send(queue, payload)`, `dispatch(envelope)` |
| `QueueSenderModule` | `abstract/sender/queue-sender.module.ts` | `forRoot`/`forRootAsync` — binds a sender adapter |
| `QueueConsumerHandler<TPayload>` | `abstract/consumer/queue-consumer.handler.ts` | Base class for a domain's per-queue message handler — `handle(payload, ctx)` |
| `QueueConsumerModule` | `abstract/consumer/queue-consumer.module.ts` | `forRoot`/`forRootAsync({ consumers: [...] })` — binds a consumer adapter and starts every registered handler |
| `MessageContext` | `abstract/consumer/queue-consumer.interfaces.ts` | Per-message `ack()`/`nack()`, `messageId`, `deliveryCount` |
| `QueueSenderError`, `QUEUE_SENDER_ERRORS` | `abstract/sender/queue-sender.error.ts` | Sender error type/codes — `send`/`dispatch` never leak a raw broker error |
| `QueueConsumerError`, `QUEUE_CONSUMER_ERRORS` | `abstract/consumer/queue-consumer.error.ts` | Consumer error type/codes |
| `BullMqSenderAdapter`, `BullMqConsumerAdapter` | `bullmq-adapter/` | The wired default. Named outside this module only in `queues.module.ts` |
| `RabbitMqSenderAdapter`/`RabbitMqConsumerAdapter`, `Sqs*Adapter` | `rabbitmq-adapter/`, `sqs-adapter/` | Available, not wired anywhere today |

## Configuration

`redisScope` (`src/redis.scope.ts`, shared with `src/cache/redis-adapter/`)
configures the wired BullMQ connection. `rabbitmqScope`
(`rabbitmq-adapter/config/rabbitmq.scope.ts`) exists for the RabbitMQ
adapter's own connection config and is registered in
`ConfigProviderAbstractModule`'s `scopes` even though nothing constructs a
`RabbitMqSenderAdapter`/`RabbitMqConsumerAdapter` from it yet.

## Rules

1. Consumers inject the abstract `QueueSenderService` where only `send`/
   `dispatch` (broker-agnostic `delay`/`priority`) are needed. A consumer
   needing adapter-specific options (BullMQ `attempts`/`backoff`, etc.)
   injects the concrete adapter class directly and is coupled to that
   broker by design — `src/spaceship/notification/notification.producer.ts`
   is the reference. Note this coupling in the consuming module's own guide;
   don't hide it.
2. `QueueConsumerModule.forRoot(Async)` takes **one** `consumers:
   ConsumerRegistration[]` array for the whole app, not a `forFeature` per
   domain module. That forces `queues.module.ts` to import the domain
   handler classes it registers (currently
   `SpaceshipNotificationProcessor`) and any non-global providers those
   handlers depend on — handlers are instantiated inside
   `QueueConsumerModule`'s own dynamic-module scope, not the domain
   module's. This is the one sanctioned exception to "does not own a
   domain handler" above, forced by the API shape, not a precedent for
   putting business logic in `src/queues/` itself.
3. Adapters translate errors: `QueueSenderError`/`QueueConsumerError` with a
   code from `QUEUE_SENDER_ERRORS`/`QUEUE_CONSUMER_ERRORS`, never a raw
   `bullmq`/`amqplib`/`@aws-sdk/client-sqs` error (invariant `T3`).
4. A sender adapter that doesn't support a requested delivery option throws
   `UNSUPPORTED_OPTION` (`abstract/sender/queue-delivery-options.util.ts`)
   rather than silently dropping it.
5. A handler must be singleton-scoped — `QueueConsumerModule` resolves it
   once via `ModuleRef.get` at startup; request/transient scope is
   unsupported.

## Tests

`*.unit.spec.ts`, colocated under each directory's `tests/` subfolder
(`abstract/tests/`, `bullmq-adapter/tests/`, `rabbitmq-adapter/tests/`,
`sqs-adapter/tests/`).

## Reuse

`abstract/` depends only on `@nestjs/common`. `bullmq-adapter/` additionally
needs `bullmq` plus `src/redis.scope.ts` (or a queues-local replacement if
lifting it without `cache/`); `rabbitmq-adapter/` needs `amqplib` (+
`rabbitmq.scope.ts`); `sqs-adapter/` needs `@aws-sdk/client-sqs`. Copy
`abstract/` plus the adapter directories you want — never copy a domain
module's `QueueConsumerHandler` alongside it.

## Known gaps

- RabbitMQ and SQS adapters are complete but unwired: only BullMQ is
  registered in `queues.module.ts`. Selecting either today means writing
  the `QueueSenderModule`/`QueueConsumerModule` wiring yourself.
- `queues.module.ts` names a domain handler class and imports a
  domain-specific recipients module (see Rule 2) — a real, visible
  deviation from "generic infra module, zero domain knowledge" that every
  other adapter module in this template holds to. It's forced by
  `QueueConsumerModule`'s single-registration-call API; a `forFeature`-style
  per-domain registration (like the module-contract's other modules use)
  would remove it, but wasn't implemented.
- `notification.producer.ts` injecting the concrete `BullMqSenderAdapter`
  (Rule 1) means swapping the wired adapter away from BullMQ silently breaks
  spaceship notifications' retry/backoff — no compile-time or startup check
  catches it.
