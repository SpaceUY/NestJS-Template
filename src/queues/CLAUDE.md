# Queues — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/queues/`.

## Scope

Owns a provider-agnostic queue **producer** abstraction and the pluggable
BullMQ/RabbitMQ adapters behind it, selected at boot by `QUEUE_ADAPTER`.

Does not own: any queue's job payload shape, processor/consumer, or the
business logic that runs when a job is handled. Those belong to the domain
module that owns the queue — e.g. `src/spaceship/notification/` — which
depends on this module, never the other way around. `src/queues/` must stay
liftable into another project on its own; a domain-specific consumer living
here would break that.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `QueueProducer` | `src/queues/abstract/queue-producer.service.ts` | The contract: `enqueue(jobName, data, options?)` — inject this |
| `QueueAbstractModule` | `src/queues/abstract/queue-abstract.module.ts` | `forRoot()` (once, in `QueuesModule`) / `forFeature(queueName)` (per queue, in the owning domain module) |
| `getQueueProducerToken` | `src/queues/abstract/queue.tokens.ts` | Builds the per-queue DI token — `QueueProducer` is bound per queue name, not to the class itself |
| `EnqueueOptions`, `EnqueueResult` | `src/queues/abstract/queue.interfaces.ts` | Vendor-agnostic enqueue options and result shape |
| `QueueError`, `QUEUE_ERRORS` | `src/queues/abstract/queue.error.ts` | Error type and codes — every `enqueue()` throws this, never a raw `bullmq`/`amqplib` error |
| `QUEUE_ADAPTERS` | `src/queues/abstract/queue-abstract.module.ts` | The supported `QUEUE_ADAPTER` values (`BULLMQ`, `RABBITMQ`) |
| `BullmqProducerService`, `RabbitmqProducerService` | `src/queues/bullmq-adapter/`, `src/queues/rabbitmq-adapter/` | Named only inside `resolveAdapterModule()` in `abstract/queue-abstract.module.ts` |

## Configuration

`QUEUE_ADAPTER` (`BULLMQ` default, or `RABBITMQ`) is read directly via
`process.env` in `abstract/queue-abstract.module.ts`, not through a config
scope plus DI like every other module's configuration (invariant `T2`). This
is deliberate and is the **only** sanctioned exception to `T2` in this
template: NestJS resolves a module's `imports` array synchronously at
class-decoration time, before any DI container or async factory chain exists,
so the adapter choice cannot be threaded through `ConfigProviderService` the
way `redisScope`/`rabbitmqScope` are for the adapters' own runtime
config. Do not copy this pattern for anything other than a synchronous
adapter-selection decision made inside a static `imports` array — everything
else still goes through a config scope. See `README.md`'s "Adapter selection"
section for the full rationale.

## Rules

1. Inject `QueueProducer` via `@Inject(getQueueProducerToken(queueName))`,
   never the bare class — a class-level token would make a second queue's
   registration silently overwrite the first's.
2. Feature code only ever calls `QueueAbstractModule.forRoot()` /
   `.forFeature(queueName)`. `BullmqProducerService` and
   `RabbitmqProducerService` are named in exactly one place —
   `resolveAdapterModule()` — per invariant `T1`.
3. `enqueue()` always throws `QueueError` with a `QUEUE_ENQUEUE_FAILED` code
   and job context in `data` (invariant `T3`); a caller never sees a raw
   `ioredis`/`bullmq`/`amqplib` error.
4. Processors/consumers are not part of this module's contract — see "Adding
   an adapter" in `README.md` and the "Does not own" line above. A queue's
   consumer is adapter-specific by design (BullMQ worker vs. RabbitMQ channel
   consumer have no shared semantics) and lives with the domain module.
5. **RabbitMQ is producer-only today.** `RabbitmqAdapterModule.forFeature`
   logs a `LoggerService.warn` on every registration because this template
   ships no RabbitMQ consumer — selecting `QUEUE_ADAPTER=RABBITMQ` for a queue
   whose only processor is BullMQ-specific silently accumulates unconsumed
   messages. See "Known gaps".

## Tests

New tests use `*.unit.spec.ts`. `abstract/queue-abstract.module.di.spec.ts` is
a deliberate third convention alongside that: it boots the real Nest module
graph (`Test.createTestingModule` with the actual `QueueAbstractModule`, not a
shape-only construction) to catch export/DI-wiring mistakes that a
`*.unit.spec.ts` — which only inspects the returned `DynamicModule` object —
cannot see. Add a `.di.spec.ts` only for that purpose; ordinary unit tests
stay `*.unit.spec.ts`.

## Reuse

`abstract/` depends only on `@nestjs/common`. `bullmq-adapter/` additionally
needs `bullmq`/`ioredis` plus `src/redis.scope.ts` (shared with
`src/cache/redis-adapter/` — bring it along, or replace it with a
queues-local scope if lifting `bullmq-adapter/` without `cache/`);
`rabbitmq-adapter/` needs `amqplib`. Copy `abstract/` plus the adapter
directories you want — never copy a domain module's queue consumer alongside
it.

## Known gaps

- RabbitMQ has no consumer/processor built for it. A queue that only ships a
  BullMQ `@Processor` (the only kind this template has) silently drops
  messages under `QUEUE_ADAPTER=RABBITMQ`; only a runtime warning log exists
  today, not a startup-time check. See `README.md`'s "RabbitMQ adapter notes".
- The `dotenv.config()` call in `abstract/queue-abstract.module.ts` duplicates
  part of what `EnvConfigAdapter` (`src/config-provider/`) already does for
  the rest of the app's configuration; it cannot be removed without also
  removing the `T2` exception above, so the duplication is deliberate, not an
  oversight — but it is still two independent `.env`-loading code paths.
- `rabbitmq-adapter/` never closes its `amqplib` connection/channel on
  shutdown — no `onModuleDestroy`/`onApplicationShutdown` hook exists for
  them, unlike `@nestjs/bullmq`'s `BullModule`, which manages the BullMQ
  connection lifecycle itself. Not a correctness bug today, but worth fixing
  before relying on this adapter in production.
