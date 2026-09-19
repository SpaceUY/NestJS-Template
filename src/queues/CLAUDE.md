# Queues — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/queues/`.

## Scope

Owns a provider-agnostic **producer** and **consumer** abstraction for message
queues, plus the BullMQ, RabbitMQ and SQS adapters behind them. Unlike the
single-abstract-class shape most modules use, queues are bidirectional, so
the contract is split in two: `QueueProducerService` (publish) and
`QueueConsumerAdapter`/`QueueConsumerHandler` (consume). BullMQ is the only
adapter wired by default; RabbitMQ and SQS
ship complete but unwired — see "Known gaps".

Does not own: a queue's job payload shape or the business logic that runs
when a message is handled — that's `QueueConsumerHandler` subclasses living
with the domain module. `src/queues/`
must stay liftable into another project on its own; a domain handler
*living* here would break that — see "Rules" for the one place this module
still has to name one.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `QueueProducerService` | `abstract/producer/queue-producer.service.ts` | Abstract contract/DI token: `send(queue, payload)`, `dispatch(envelope)` |
| `QueueProducerModule` | `abstract/producer/queue-producer.module.ts` | `forRoot`/`forRootAsync` — binds a producer adapter |
| `QueueConsumerHandler<TPayload>` | `abstract/consumer/queue-consumer.handler.ts` | Base class for a domain's per-queue message handler — `handle(payload, ctx)` |
| `QueueConsumerModule` | `abstract/consumer/queue-consumer.module.ts` | `forRoot`/`forRootAsync({ consumers: [...] })` — binds a consumer adapter and starts every registered handler |
| `MessageContext` | `abstract/consumer/queue-consumer.interfaces.ts` | Per-message `ack()`/`nack()`, `messageId`, `deliveryCount` |
| `QueueProducerError`, `QUEUE_PRODUCER_ERRORS` | `abstract/producer/queue-producer.error.ts` | Producer error type/codes — `send`/`dispatch` never leak a raw broker error |
| `QueueConsumerError`, `QUEUE_CONSUMER_ERRORS` | `abstract/consumer/queue-consumer.error.ts` | Consumer error type/codes |
| `BullMqProducerAdapter`, `BullMqConsumerAdapter` | `bullmq-adapter/` | The wired default. Named outside this module only in `queues.module.ts` |
| `RabbitMqProducerAdapter`/`RabbitMqConsumerAdapter`, `Sqs*Adapter` | `rabbitmq-adapter/`, `sqs-adapter/` | Available, not wired anywhere today |

## Configuration

`redisScope` (`src/redis.scope.ts`, shared with `src/cache/redis-adapter/`)
configures the wired BullMQ connection. `rabbitmqScope`
(`rabbitmq-adapter/config/rabbitmq.scope.ts`) exists for the RabbitMQ
adapter's own connection config and is registered in
`ConfigProviderAbstractModule`'s `scopes` even though nothing constructs a
`RabbitMqProducerAdapter`/`RabbitMqConsumerAdapter` from it yet.

## Rules

1. Consumers inject the abstract `QueueProducerService` where only `send`/
   `dispatch` (broker-agnostic `delay`/`priority`) are needed. A consumer
   needing adapter-specific options (BullMQ `attempts`/`backoff`, etc.)
   injects the concrete adapter class directly and is coupled to that
   broker by design — a consuming project's own producer is the
   reference. Note this coupling in the consuming module's own guide;
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
3. Adapters translate errors: `QueueProducerError`/`QueueConsumerError` with a
   code from `QUEUE_PRODUCER_ERRORS`/`QUEUE_CONSUMER_ERRORS`, never a raw
   `bullmq`/`amqplib`/`@aws-sdk/client-sqs` error (invariant `T3`).
4. A producer adapter that doesn't support a requested delivery option throws
   `UNSUPPORTED_OPTION` (`abstract/producer/queue-delivery-options.util.ts`)
   rather than silently dropping it.
5. A handler must be singleton-scoped — `QueueConsumerModule` resolves it
   once via `ModuleRef.get` at startup; request/transient scope is
   unsupported.

## Tests

`*.unit.spec.ts` under each directory's `tests/` subfolder (`abstract/tests/`,
`bullmq-adapter/tests/`, `rabbitmq-adapter/tests/`, `sqs-adapter/tests/`).

Note this is a **divergence** from the repo-root convention, which colocates
specs next to the file under test; `src/queues/` is the only module using the
subfolder layout. Keep new queue specs consistent with their neighbours here
rather than "fixing" them one at a time.

`abstract/tests/queues.module.di.spec.ts` compiles the real Nest graph, unlike
the shape-only module specs beside it. It exists because three things here fail
only on actual resolution: the `BullMqProducerAdapter` alias over a global dynamic
module, handler instantiation inside `QueueConsumerModule`'s injector scope, and
the `imports` array carrying a handler's non-global dependencies. Changing any
of those without running it is how a wiring bug reaches production.

## Reuse

`abstract/` depends on `@nestjs/common` **and**
`src/common/observability/logger/` — `LoggerService`/`NestLoggerAdapter` are
imported by `abstract/producer/queue-producer.service.ts`,
`abstract/producer/queue-producer.module.ts`,
`abstract/consumer/queue-consumer.adapter.ts` and
`abstract/consumer/queue-consumer.module.ts`. `bullmq-adapter/` additionally
needs `bullmq` plus `src/redis.scope.ts` (or a queues-local replacement if
lifting it without `cache/`); `rabbitmq-adapter/` needs `amqplib` (+
`rabbitmq.scope.ts`); `sqs-adapter/` needs `@aws-sdk/client-sqs`.

## Known gaps

See `docs/audit/2026-09-18-modularity-audit.md`.

- RabbitMQ and SQS adapters are complete but unwired: only BullMQ is
  registered in `src/app.module.ts`. Selecting either today means writing
  the `QueueProducerModule`/`QueueConsumerModule` wiring yourself.
