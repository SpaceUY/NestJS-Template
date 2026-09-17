# Queues

Follows the same `abstract/` contract + `<name>-adapter/` pattern used by
`email/` and `cache/`: feature code depends on the abstract `QueueProducer`
class (`abstract/queue-producer.service.ts`), never on a vendor SDK.

## Producer vs. processor

Only the **producer** (enqueue) side is abstracted. The **processor**
(worker/consumer) stays adapter-specific on purpose: BullMQ and RabbitMQ (or
any other broker) don't share real consumption semantics (in-process
decorated worker with native retry/backoff vs. channel consumer with manual
ack/nack and DLQs), so a shared consumer interface would either be too thin
to matter or force both adapters into an artificial shape. The processor is
therefore owned by the domain module that consumes the queue, not by this
module — see `src/spaceship/notification/notification.processor.ts` for the
one example in this template. It is BullMQ-specific, and — see "RabbitMQ
adapter notes" below — that has a real operational consequence today, not
just an implementation detail.

This module never contains domain-specific queue consumers itself: a queue
name, its job payload shape, and its processor belong to the domain that
owns the business logic (e.g. `src/spaceship/notification/`), which depends
on `queues/` — never the other way around.

## Per-queue DI tokens

Unlike `EmailService`/`CacheService` (one global instance for the whole
app), a template can have multiple independent queues. `QueueProducer` is
therefore bound per queue name via `getQueueProducerToken(queueName)`
(`abstract/queue.tokens.ts`), not to the `QueueProducer` class itself —
binding every queue to one shared class-token would make a second queue's
registration silently overwrite the first's.

## Adapter selection

`QueueAbstractModule` (`abstract/queue-abstract.module.ts`) is the single
place that knows which vendor adapter is active. It reads the `QUEUE_ADAPTER`
env var — `BULLMQ` (default) or `RABBITMQ` — and resolves to the matching
adapter module (`BullmqAdapterModule` or `RabbitmqAdapterModule`); anything
else throws a clear startup error. `QUEUE_ADAPTER` is read directly via
`process.env` (after an explicit `dotenv.config()` call in this file), not
through the codebase's usual Joi-scope-plus-DI pattern, because NestJS
module `imports` arrays are resolved synchronously at module-decoration
time and can't consume the async config-provider chain the way a factory
provider's return value can.

`QueueAbstractModule` exposes the same two entry points every consumer
needs, and neither one leaks the chosen vendor to its caller:

- `QueueAbstractModule.forRoot()` — establishes the vendor connection once.
  Used by `queues.module.ts`, imported once in `AppModule`.
- `QueueAbstractModule.forFeature(queueName)` — registers one named queue
  and provides `QueueProducer` under `getQueueProducerToken(queueName)`.
  `src/spaceship/notification/notification.module.ts` imports this — it has
  no dependency on `bullmq`, `amqplib`, or either adapter's module, only on
  `QueueAbstractModule` and the abstract `QueueProducer` contract. Swapping
  `QUEUE_ADAPTER` from `BULLMQ` to `RABBITMQ` changes which adapter
  `forRoot`/`forFeature` delegate to internally — no domain module,
  `SpaceshipService`, or `SpaceshipNotificationProducer` needs to change.

Adding a third adapter means: build `<name>-adapter/` (contract-conformant
producer + `forRoot`/`forFeature`), add its name to `QUEUE_ADAPTERS` and the
`resolveAdapterModule()` switch in `queue-abstract.module.ts`, and give it
its own config scope. Nothing outside `queues/` changes.

## RabbitMQ adapter notes

`rabbitmq-adapter/` uses `amqplib` directly. `forRoot()` opens a **confirm
channel** (`connection.createConfirmChannel()`), and `enqueue()` waits for
the broker to ack the publish before resolving — the same durability
guarantee BullMQ's `queue.add()` gives (it only resolves once Redis has the
job), not just a local socket write. Unlike BullMQ, plain RabbitMQ has no
built-in per-message retry/backoff — `EnqueueOptions.attempts`/`delayMs`/
`backoff` are captured as message headers (`x-attempts`, `x-delay-ms`,
`x-backoff-type`, `x-backoff-delay-ms`) rather than silently dropped, so a
future RabbitMQ consumer can implement retry semantics against them (e.g.
via a dead-letter exchange).

**RabbitMQ is producer-only today — there is no RabbitMQ consumer/processor.**
`src/spaceship/notification/notification.processor.ts` only runs as a BullMQ
worker (`@Processor` from `@nestjs/bullmq`). Setting `QUEUE_ADAPTER=RABBITMQ` publishes the
`spaceship-created` job to a real RabbitMQ queue (durably, confirmed by the
broker), but nothing ever consumes it: the spaceship-created email is not
sent, and no error is raised anywhere — the messages just accumulate on the
queue. Do not select `RABBITMQ` in an environment that needs the
spaceship-created email to actually go out until a RabbitMQ processor is
built alongside it.
