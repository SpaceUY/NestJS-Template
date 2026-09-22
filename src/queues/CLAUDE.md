# Queues — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded). Read it first — this file
> adds only what is specific to `src/queues/`.

## Scope

Owns a provider-agnostic **producer** and **consumer** abstraction for message
queues, plus the BullMQ, RabbitMQ and SQS adapters behind them. Unlike the
single-abstract-class shape most modules use, queues are bidirectional, so
the contract is split in two: `QueueProducerService` (publish) and
`QueueConsumerAdapter`/`QueueConsumerHandler` (consume). BullMQ is the only
adapter wired by default — in `src/app.module.ts`, the way every other adapter
module here is wired; RabbitMQ and SQS ship complete but unwired, see "Known
gaps".

Does not own: a queue's job payload shape or the business logic that runs when
a message is handled — that's `QueueConsumerHandler` subclasses living with the
domain module. `src/queues/` must stay liftable into another project on its
own, so no file under it names a domain class anywhere: a domain module binds
its own handler to a queue with `QueueConsumerModule.forFeature` (Rule 2) and
this module only ever sees the binding.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `QueueProducerService` | `abstract/producer/queue-producer.service.ts` | Abstract contract/DI token: `send(queue, payload)`, `dispatch(envelope)` |
| `QueueProducerModule` | `abstract/producer/queue-producer.module.ts` | `forRoot`/`forRootAsync` — binds a producer adapter |
| `QueueConsumerHandler<TPayload>` | `abstract/consumer/queue-consumer.handler.ts` | Base class for a domain's per-queue message handler — `handle(payload, ctx)` |
| `QueueConsumerModule` | `abstract/consumer/queue-consumer.module.ts` | `forRoot`/`forRootAsync` — binds a consumer adapter; `forFeature(consumers)` — a domain module registers its own queue↔handler bindings |
| `MessageContext` | `abstract/consumer/queue-consumer.interfaces.ts` | Per-message `ack()`/`nack()`, `messageId`, `deliveryCount` |
| `QueueProducerError`, `QUEUE_PRODUCER_ERRORS` | `abstract/producer/queue-producer.error.ts` | Producer error type/codes — `send`/`dispatch` never leak a raw broker error |
| `QueueConsumerError`, `QUEUE_CONSUMER_ERRORS` | `abstract/consumer/queue-consumer.error.ts` | Consumer error type/codes |
| `BullMqProducerAdapter`, `BullMqConsumerAdapter` | `bullmq-adapter/` | The wired default. Named outside this module in `src/app.module.ts`, and — for the producer only — in `src/spaceship/notification/`, which is the `T1` exception Rule 1 below sanctions |
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
   broker by design. Nothing here makes the concrete class injectable — the
   consuming module aliases it in its own wiring, behind an `instanceof` guard
   so that a broker swap fails at startup rather than inside a request.
   `src/spaceship/notification/notification.module.ts` is the worked example,
   and `src/queues/README.md`'s `## Registration` section has the recipe. Note
   this coupling in the consuming module's own guide; don't hide it.
2. A domain module registers its own consumers with
   `QueueConsumerModule.forFeature([{ queue, handler }])` and declares the
   handler class in its own `providers`. The handler's dependencies then
   resolve in that module's injector, so nothing in `src/queues/` ever names
   a domain class. This requires the root registration
   (`forRoot`/`forRootAsync` in `src/app.module.ts`) to set `isGlobal: true`,
   since the feature module injects `QueueConsumerAdapter` without importing
   the root. The root's own `consumers` array still works and is still
   supported, but it provides the handler classes inside the root's own
   injector — use it only for an app small enough that one module may know
   every handler.
3. Adapters translate errors: `QueueProducerError`/`QueueConsumerError` with a
   code from `QUEUE_PRODUCER_ERRORS`/`QUEUE_CONSUMER_ERRORS`, never a raw
   `bullmq`/`amqplib`/`@aws-sdk/client-sqs` error (invariant `T3`).
4. A producer adapter that doesn't support a requested delivery option throws
   `UNSUPPORTED_OPTION` (`abstract/producer/queue-delivery-options.util.ts`)
   rather than silently dropping it.
5. A handler must be singleton-scoped — both registration paths resolve it
   once via `ModuleRef.get` at startup (`forFeature` with
   `{ strict: false }`, since the handler lives in another module);
   request/transient scope is unsupported.

## Tests

`*.unit.spec.ts` under each directory's `tests/` subfolder (`abstract/tests/`,
`bullmq-adapter/tests/`, `rabbitmq-adapter/tests/`, `sqs-adapter/tests/`).

Note this is a **divergence** from the repo-root convention, which colocates
specs next to the file under test; `src/queues/` is the only module using the
subfolder layout. Keep new queue specs consistent with their neighbours here
rather than "fixing" them one at a time.

`abstract/tests/queue-consumer-feature.module.di.spec.ts` compiles the real Nest
graph, unlike the shape-only module specs beside it. It exists because three
things here fail only on actual resolution: a consumer adapter built by
`forRootAsync` from a real config scope, a handler resolved by `forFeature` out
of the domain module that owns it (together with that module's own non-global
provider, which the handler injects), and the callback the adapter is actually
bound to reaching that same handler instance. It is also this module's
executable example — the graph `src/queues/README.md`'s `## Registration`
section describes. Changing any of that without running it is how a wiring bug reaches
production.

Its second `describe` compiles **two** domain modules, each with its own
`forFeature` call. Every call returns a `DynamicModule` whose `module` is the
same class, and Nest identifies a dynamic module by a token derived from that
class plus its metadata — if two calls ever collapsed to one token, the second
registration would be dropped and the app would boot clean with one queue
silently unconsumed. Verified working; keep the case whenever this file moves.

## Reuse

Scoped to the narrowest useful copy — `abstract/` plus one adapter directory,
which needs `src/config-provider/` only when that adapter is
`rabbitmq-adapter/` (its scope file imports from there). Lifting all of
`src/queues/`, `tests/` folders included, needs `src/config-provider/` either
way; the root `README.md` measures that wider scope.

`abstract/` depends on `@nestjs/common` **and**
`src/common/observability/logger/` — `LoggerService`/`NestLoggerAdapter` are
imported by `abstract/producer/queue-producer.service.ts`,
`abstract/producer/queue-producer.module.ts`,
`abstract/consumer/queue-consumer.adapter.ts` and
`abstract/consumer/queue-consumer.module.ts`. `bullmq-adapter/` additionally
needs `bullmq` plus `src/redis.scope.ts` (or a queues-local replacement if
lifting it without `cache/`); `rabbitmq-adapter/` needs `amqplib` (+
`rabbitmq.scope.ts`); `sqs-adapter/` needs `@aws-sdk/client-sqs`.

`src/queues/README.md`'s `## Reuse` is the human version of this section. Keep
the two congruent (`T7`).

## Known gaps

**An optional adapter option must be omitted, never passed as `undefined`.**
BullMQ validates a key whenever it is present, so `concurrency: undefined`
throws `concurrency must be a finite number greater than 0` and the worker never
starts — the queue then sits there accepting jobs that nothing consumes, with
the application booting clean. `bullmq-adapter/` spreads the key conditionally;
`rabbitmq-adapter/` does the same for `prefetch`, and the producers for
`delay`/`priority`. Follow that shape, and assert the key's *absence* in the
spec.

**A spec that mocks the broker validates nothing about the broker.** The adapter
specs mock `Worker`, so they cannot see an option the real BullMQ would reject.
`abstract/tests/queue-consumer-feature.module.di.spec.ts` compiles a real Nest
graph for the registration path; anything beyond that needs the application
actually running against Redis.

**Every consumer holds an open connection, so teardown has to close them.**
All three consumer adapters implement `onModuleDestroy` and stop every queue
they own, including one started by calling the adapter directly. A worker left
running keeps the process alive past `app.close()`.

**RabbitMQ and SQS are complete but unwired.** Only BullMQ is registered in
`src/app.module.ts`, deliberately: registering three brokers at once means three
live connections for one queue. `README.md`'s **Switching the template's broker**
has the exact edit for each, the extra step SQS needs — it ships no config
scope, so you write one first — and the three behaviours that do not survive the
switch.
