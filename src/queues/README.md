# Queues Module

Provider-agnostic message queues for NestJS using the same adapter pattern as
`cache`, `email`, `cloud-storage`, and `config-provider`. No
`@nestjs/microservices`, no decorators — adapters are built directly against raw
broker libraries (e.g. `amqplib`, AWS SDK v3).

The module is split into two **independent** dynamic modules, each with its own
connection to the broker:

- **`QueueProducerModule`** — publishing messages.
- **`QueueConsumerModule`** — consuming messages.

Three concrete adapters ship alongside the abstract contracts: BullMQ, RabbitMQ
and SQS. Only BullMQ is wired by default, in `src/app.module.ts`; selecting
either of the others means writing that wiring yourself.

## Directory Structure

```text
src/queues/
├── abstract/
│   ├── producer/
│   │   ├── queue-producer.service.ts        # abstract QueueProducerService (DI token)
│   │   ├── queue-producer.module.ts         # QueueProducerModule
│   │   ├── queue-producer.interfaces.ts     # QueueEnvelope, module options
│   │   ├── queue-delivery-options.util.ts # assertSupportedDeliveryOptions
│   │   └── queue-producer.error.ts          # QueueProducerError
│   ├── consumer/
│   │   ├── queue-consumer.adapter.ts      # abstract QueueConsumerAdapter (DI token)
│   │   ├── queue-consumer.handler.ts      # abstract QueueConsumerHandler<T>
│   │   ├── queue-consumer.module.ts       # QueueConsumerModule
│   │   ├── queue-consumer.interfaces.ts   # MessageContext, ConsumerRegistration, options
│   │   └── queue-consumer.error.ts        # QueueConsumerError
│   └── tests/
├── bullmq-adapter/                        # the wired default (bullmq + redisScope)
├── rabbitmq-adapter/                      # complete, unwired (amqplib + rabbitmqScope)
├── sqs-adapter/                           # complete, unwired (@aws-sdk/client-sqs)
├── CLAUDE.md
└── README.md
```

## Core Contracts

### Producer — `QueueProducerService`

The abstract class doubles as the NestJS injection token. Inject it to publish.

- `send(queue, payload)` — fire-and-forget shorthand.
- `dispatch(envelope)` — advanced path when headers/envelope metadata are needed.

```ts
export interface QueueEnvelope {
  queue: string;
  payload: unknown;
  headers?: Record<string, string>;
  options?: QueueDeliveryOptions; // delay / priority — see Delivery Options
}
```

`QueueEnvelope` carries only fields universal across brokers. Broker-specific
concerns (routing keys, exchanges, partition keys, delays) are handled by
adapter-level extensions.

### Consumer — `QueueConsumerAdapter` + `QueueConsumerHandler`

The consumer side has two abstracts: the **adapter** (broker-specific wiring,
implemented by infrastructure code) and the **handler** (business logic,
implemented by application code, one class per queue).

```ts
abstract class QueueConsumerHandler<TPayload = unknown> {
  abstract handle(payload: TPayload, ctx: MessageContext): Promise<void>;
}
```

Handlers are registered as NestJS providers, so they can inject services through
their constructor. Where they are provided decides where their dependencies
resolve. Declared in the domain module and registered with
`QueueConsumerModule.forFeature`, a handler resolves in that module's own
injector and its collaborators need no special treatment. Passed instead to the
root's `consumers` array, it is provided inside `QueueConsumerModule`'s own
dynamic-module scope, so its dependencies must be globally-provided or reachable
through a module passed to `forRootAsync`'s `imports`. See `## Registration`.

### `MessageContext`

Passed to every `handle()` call. Ignored for simple cases; used directly for
explicit acknowledgment control.

```ts
export interface MessageContext {
  readonly messageId?: string;
  readonly headers: Record<string, string>;
  readonly deliveryCount?: number; // 1-based; undefined when the broker can't report it
  ack(): Promise<void>;
  nack(opts?: { requeue?: boolean }): Promise<void>;
}
```

`deliveryCount` is the cross-broker read-side companion to retries — useful for
poison-message handling (`if (ctx.deliveryCount > 5) ctx.nack({ requeue: false })`).
It maps to SQS `ApproximateReceiveCount`, BullMQ `attemptsMade + 1`, and RabbitMQ
the `x-death` header (so on RabbitMQ it's only populated with a dead-letter retry
setup; otherwise `undefined`).

## Registration

### Producer

```ts
// Synchronous — adapter has a no-arg constructor
QueueProducerModule.forRoot({
  adapter: MyBrokerProducerAdapter,
  isGlobal: true,
});

// Async — adapter config injected from DI
QueueProducerModule.forRootAsync({
  inject: [someConfig.KEY],
  useFactory: (config) => new MyBrokerProducerAdapter({ url: config.brokerUrl }),
  isGlobal: true,
});
```

#### Reaching adapter-specific methods

`QueueProducerService` exposes only the broker-agnostic `send`/`dispatch`.
BullMQ's `addJob` (retry attempts, backoff) lives on the concrete adapter, so
a project that needs it aliases the concrete class in its own wiring:

```ts
{
  provide: BullMqProducerAdapter,
  useFactory: (producer: QueueProducerService): BullMqProducerAdapter => {
    if (!(producer instanceof BullMqProducerAdapter)) {
      throw new Error(
        `BullMqProducerAdapter was requested but the wired producer is ${producer.constructor.name}.`,
      );
    }
    return producer;
  },
  inject: [QueueProducerService],
}
```

The `instanceof` guard matters: a plain `useExisting` alias still compiles and
still boots after the adapter is swapped for RabbitMQ or SQS, and the first
`addJob` call then dies with "is not a function" in the request path. The
template does not ship this provider — nothing in it needs BullMQ-specific
options.

### Consumer

The root registration binds the adapter. It also accepts a `consumers` array,
which declares every handler in one place; the adapter config can come from DI
(`forRootAsync`), but those consumer class references stay synchronous. The
array is optional — see the per-feature path below, which is the one to use
for anything but a trivial app.

```ts
// Synchronous
QueueConsumerModule.forRoot({
  adapter: MyBrokerConsumerAdapter,
  consumers: [
    { queue: 'orders', handler: OrdersHandler },
    { queue: 'notifications', handler: NotificationsHandler },
  ],
  isGlobal: true,
});

// Async — adapter config injected from DI
QueueConsumerModule.forRootAsync({
  inject: [someConfig.KEY],
  useFactory: (config) => new MyBrokerConsumerAdapter({ url: config.brokerUrl }),
  consumers: [{ queue: 'orders', handler: OrdersHandler }],
  isGlobal: true,
});
```

On `OnModuleInit`, the module resolves each handler from the NestJS container
(via `ModuleRef`) and calls `adapter.startConsuming(queue, handler.handle)` per
registration. On `OnModuleDestroy`, it calls `adapter.stopConsuming(queue)` for
each.

Both modules optionally inject `LoggerService` from the container and call
`setLogger()` on the adapter instance — the same pattern `email`,
`cloud-storage` and `config-provider` use. `setLogger()` re-tags the logger's
context with the adapter's class name, which is safe because `LoggerService` is
registered as `Scope.TRANSIENT`. With no `LoggerService` registered, the adapter
keeps its own `NestLoggerAdapter` default.

### Consumer — per-feature registration

The root registration above provides the adapter. Each domain module then
registers its own handlers:

```ts
// src/invoicing/invoicing-queue.module.ts
import { Module } from '@nestjs/common';
import { QueueConsumerModule } from '../queues/abstract/consumer/queue-consumer.module';
import { InvoiceProcessor } from './invoice.processor';
import { InvoiceRecipients } from './invoice-recipients.provider';

@Module({
  imports: [
    QueueConsumerModule.forFeature([
      { queue: 'invoices', handler: InvoiceProcessor },
    ]),
  ],
  providers: [InvoiceProcessor, InvoiceRecipients],
})
export class InvoicingQueueModule {}
```

`forFeature` does not provide `InvoiceProcessor` — this module does. That is
why `InvoiceRecipients`, a non-global provider, resolves without anyone
copying it into the queue registration. The module starts consuming its own
queues on init and stops them on shutdown, independently of every other
feature.

Two requirements: the root must be registered with `isGlobal: true`, and
handlers must be singleton-scoped (`ModuleRef.get` resolves nothing else).

A working version of exactly this graph is compiled and asserted in
`src/queues/abstract/tests/queue-consumer-feature.module.di.spec.ts` — read
that file rather than trusting this snippet, since it is the one CI runs.

## Acknowledgment Contract

Implicit acknowledgment is the **adapter's responsibility**. Adapters track
whether `ack`/`nack` was already called on a message (a `wasAcknowledged` flag on
their concrete `MessageContext` implementation) and apply these rules:

| Situation | Adapter behavior |
|---|---|
| `handle()` resolves, no explicit ack/nack | calls `ack()` automatically |
| `handle()` throws, no explicit ack/nack | calls `nack()` automatically |
| `ack()` or `nack()` called explicitly | skips the implicit call |

This keeps simple handlers ceremony-free while leaving full control available
when needed:

```ts
@Injectable()
export class OrdersHandler extends QueueConsumerHandler<OrderPayload> {
  constructor(private readonly orders: OrdersService) {
    super();
  }

  async handle(payload: OrderPayload, ctx: MessageContext): Promise<void> {
    // throw → implicit nack, return → implicit ack
    await this.orders.process(payload);

    // ...or take explicit control:
    // await ctx.nack({ requeue: false });
  }
}
```

## Delivery Options

`dispatch` accepts optional, broker-agnostic per-message delivery options:

```ts
await producer.dispatch({
  queue: 'orders',
  payload: { id: 1 },
  options: { delay: 5000, priority: 3 }, // ms, and relative priority
});
```

Only fields with a genuine per-message meaning across brokers live here. Richer,
broker-specific knobs (retries/backoff, cron, exchanges) stay in adapter-level
extensions (e.g. BullMQ's `addJob`, RabbitMQ's `publishToExchange`).

**Honor-or-throw**: an adapter applies an option natively or throws
`QUEUE_PRODUCER_UNSUPPORTED_OPTION` — it never silently drops one (a delay that
fires immediately is a correctness bug, not a degradation). Support matrix:

| Option | SQS | RabbitMQ | BullMQ |
|---|---|---|---|
| `delay` | ✅ `DelaySeconds` (≤15 min, standard queues only) | ❌ throws (needs a delayed-exchange plugin) | ✅ |
| `priority` | ❌ throws | ✅ (needs a priority queue) | ✅ |

Adapters validate via `assertSupportedDeliveryOptions(options, supported, name)`
([util](./abstract/producer/queue-delivery-options.util.ts)).

## What Adapters Must Implement

### Producer adapter

- Extend `QueueProducerService`.
- Implement `send(queue, payload)` and `dispatch(envelope)`.
- Accept config via constructor; use `forRootAsync` for DI-sourced config.
- Throw `QueueProducerError` on failures.

### Consumer adapter

- Extend `QueueConsumerAdapter`.
- Implement `startConsuming(queue, callback)` — connect to the broker, receive
  messages, build a concrete `MessageContext` per message, invoke the callback,
  and handle implicit ack per the contract above.
- Implement `stopConsuming(queue)` — cleanly unsubscribe / close the channel.
- Throw `QueueConsumerError` on infrastructure failures.

### Handler (application code)

- Extend `QueueConsumerHandler<TPayload>`.
- Implement `handle(payload, ctx)`.
- Throw to trigger implicit nack; call `ctx.nack()` for explicit control.
- Inject any NestJS provider via the constructor.

## Built-in Adapter: AWS SQS

A ready-to-use adapter for Amazon SQS lives in `src/queues/sqs-adapter/`
(`SqsProducerAdapter` + `SqsConsumerAdapter`). Each builds its own `SQSClient`, so
the two modules keep independent connections. Credentials are optional — prefer
IAM roles in remote environments and only pass explicit keys for local
development (same convention as the secrets-manager adapter).

```ts
// Producer
QueueProducerModule.forRoot({
  adapter: class extends SqsProducerAdapter {
    constructor() {
      super({ region: 'us-east-1' });
    }
  },
});

// ...or, with DI-sourced config:
QueueProducerModule.forRootAsync({
  inject: [awsConfig.KEY],
  useFactory: (aws) => new SqsProducerAdapter({ region: aws.region }),
});

// Consumer
QueueConsumerModule.forRootAsync({
  inject: [awsConfig.KEY],
  useFactory: (aws) =>
    new SqsConsumerAdapter({ region: aws.region, waitTimeSeconds: 20 }),
  consumers: [{ queue: 'orders', handler: OrdersHandler }],
});
```

**Queue identifier.** The `queue` string is an SQS **queue name**; the adapter
resolves it to a queue URL via `GetQueueUrl` (cached per name).

**FIFO queues.** For a `.fifo` queue, pass `MessageGroupId` (required) and
optionally `MessageDeduplicationId` through `dispatch`'s `headers` — the adapter
lifts these reserved keys into native SQS parameters and maps any remaining
headers to message attributes. A FIFO send without a `MessageGroupId` throws
`QueueProducerError(DISPATCH_FAILED)`. FIFO queues also reject the shared `delay`
option (SQS supports delay per-queue only, not per-message), so a FIFO `dispatch`
with `options.delay` throws `QUEUE_PRODUCER_UNSUPPORTED_OPTION`.

```ts
await producer.dispatch({
  queue: 'orders.fifo',
  payload: { id: 1 },
  headers: { MessageGroupId: 'tenant-42', traceId: 'abc' },
});
```

**Consuming.** SQS has no push delivery, so `SqsConsumerAdapter` runs a
long-polling worker loop per queue (configurable `waitTimeSeconds`,
`maxNumberOfMessages`, `visibilityTimeout`). `stopConsuming` aborts the loop via
an `AbortController`. Implicit ack maps to `DeleteMessage`; implicit/explicit
nack maps to `ChangeMessageVisibility`. On module shutdown both SQS adapters
destroy their `SQSClient` (`OnModuleDestroy`), releasing its pooled HTTP sockets;
the consumer stops every active poll loop first.

**Serial batch processing (by design).** Messages within a received batch are
processed one at a time, and the next poll waits for the whole batch to settle.
This keeps FIFO message-group ordering intact (a batch can carry several ordered
messages from one group) and bounds in-flight work to a single handler — so,
unlike RabbitMQ's `prefetch` or BullMQ's `concurrency`, the SQS consumer has no
intra-batch parallelism and one slow handler blocks the rest of its batch. For
higher throughput, lower `maxNumberOfMessages` and run more consumer instances.
The pause after a failed `ReceiveMessage` (so transient errors don't hot-loop)
defaults to 1000 ms and is configurable via `receiveErrorBackoffMs`.

**SQS nack limitation.** SQS has no "discard" primitive. `ctx.nack()` (requeue,
the default) sets the message's visibility timeout to `0` for immediate
redelivery; `ctx.nack({ requeue: false })` is a no-op — the message simply
reappears after its visibility timeout lapses, going to a dead-letter queue if
the queue has a redrive policy. This is an SQS constraint, not an adapter
shortcut.

## Built-in Adapter: RabbitMQ

A RabbitMQ adapter built directly on `amqplib` lives in
`src/queues/rabbitmq-adapter/` (`RabbitMqProducerAdapter` +
`RabbitMqConsumerAdapter`). Unlike SQS, RabbitMQ is a true push broker, so the
consumer uses `channel.consume` callbacks (no polling). Each adapter owns its
connection and connects **lazily** on first use (memoized); on connection
`close` it drops the cached connection so the next call reconnects — fail-fast,
no active retry loop. The same applies one level down: each adapter attaches
`error`/`close` listeners to its channel(s), so a channel that fails on its own
(a channel-level protocol error, while the connection stays up) is dropped rather
than reused dead or surfaced as an uncaught exception. On module shutdown both
adapters close their connection (`OnModuleDestroy`).

Note the reconnect is driven by the *next call*: the **producer** reconnects on its
next publish (channel and connection both rebuild lazily), so it self-heals with
no operator action. A **push consumer** has no such trigger — if its channel or
connection drops, in-flight consumers are not auto-restored and consumption stays
halted. Each registered queue's handler is retained, so recovery is a manual
lever rather than a restart: inject the concrete `RabbitMqConsumerAdapter` and
call `resume(queue)` (or `resume()` for every halted queue).

**Why this is deferred, not missing.** Reconnection *policy* — how long to back
off, when to alert, when to give up and let the process restart — is a genuine
operational concern, and the right decision depends on context the adapter
doesn't have. So the adapter deliberately stays mechanism-only (fail loudly,
expose `resume`) and leaves policy to whatever already owns supervision in your
deployment:

- **Process/orchestrator supervision** (Kubernetes liveness probe, systemd) —
  let the pod fail and restart with the platform's existing backoff. Often the
  simplest correct answer; you may not need `resume` at all.
- **An ops endpoint or admin command** that calls `resume()` — manual or scripted
  recovery without a full restart.
- **A thin in-process watcher** (health check / interval) that calls `resume()` —
  auto-recovery on your own backoff terms, in ~10 lines of app code reusing the
  lever rather than complexity baked into the shared adapter. This is the
  building block a future built-in auto-resubscribe would reuse.

What makes this safe rather than a silent outage: a channel/connection `close`
logs a **warning naming the halted queue**. Wire that warning to alerting (e.g.
Grafana, per the stack) so "consumption halted" is observable and something —
operator, supervisor, or watcher — pulls the lever.

```ts
// Producer
QueueProducerModule.forRootAsync({
  inject: [rabbitConfig.KEY],
  useFactory: (cfg) => new RabbitMqProducerAdapter({ url: cfg.url }),
});

// Consumer
QueueConsumerModule.forRootAsync({
  inject: [rabbitConfig.KEY],
  useFactory: (cfg) =>
    new RabbitMqConsumerAdapter({ url: cfg.url, prefetch: 10 }),
  consumers: [{ queue: 'orders', handler: OrdersHandler }],
});
```

**Topology (`assertTopology`, default `true`).** When on, the adapter
idempotently asserts the **durable** queues and exchanges it directly uses. When
off, it asserts nothing — infra/migrations own all topology. Either way the
adapter never creates **bindings**; queue↔exchange bindings are always managed
externally.

**Default-exchange send.** `send(queue, payload)` / `dispatch` publish to the
default exchange with routing-key = queue name, and forward non-reserved headers
as AMQP message headers.

**Message persistence.** Published messages are marked persistent by default so
they survive a broker restart (on durable queues). Set `persistent: false` on
the producer options to trade durability for throughput. (Queue/exchange
durability stays on — use `assertTopology: false` and declare your own topology
if you need non-durable infrastructure.)

**Publisher confirms.** The producer uses a [confirm
channel](https://www.rabbitmq.com/docs/confirms#publisher-confirms): `send` /
`dispatch` / `publishToExchange` resolve only once the broker has acknowledged
the message, and a broker nack rejects with `QUEUE_PRODUCER_SEND_FAILED`. So a
resolved publish means the broker accepted the message, not merely that it was
written to the local socket buffer — matching the awaited delivery guarantee of
the SQS and BullMQ producers. (This adds one broker round-trip per publish.)

**Exchanges — two ways** (per design, both are supported):

1. Dedicated, type-safe method on the concrete producer:

   ```ts
   await producer.publishToExchange({
     exchange: 'orders',
     routingKey: 'order.created',
     payload: { id: 1 },
     type: 'topic', // used only when asserting; default 'topic'
   });
   ```

2. Reserved headers on the abstract `dispatch`, for callers that only hold a
   `QueueProducerService`. `x-exchange` / `x-routing-key` are lifted out and route
   the message through that exchange (never forwarded as message headers):

   ```ts
   await producer.dispatch({
     queue: 'unused',
     payload: { id: 1 },
     headers: { 'x-exchange': 'orders', 'x-routing-key': 'order.created' },
   });
   ```

**Consuming.** One channel per queue (so `prefetch`/QoS and channel failures are
isolated). `startConsuming` optionally asserts the queue, sets `prefetch`, and
`channel.consume`s; null deliveries (broker-cancelled) are ignored. Implicit ack
→ `channel.ack`; implicit/explicit nack → `channel.nack(msg, false, requeue)` —
so `nack({ requeue: false })` is a real discard (dead-lettered if a DLX is
configured), unlike SQS. `stopConsuming` cancels the consumer and closes its
channel.

> Consuming **from an exchange** (topic/fanout) requires the queue to be bound to
> that exchange. Per the design, the adapter does not create bindings — declare
> them in infra/migrations (or assert+bind them at startup outside the adapter).

## Built-in Adapter: BullMQ

A Redis-backed adapter using [BullMQ](https://docs.bullmq.io/) lives in
`src/queues/bullmq-adapter/` (`BullMqProducerAdapter` + `BullMqConsumerAdapter`).
BullMQ is a job queue rather than a raw broker, built on `ioredis` (already a
project dependency).

```ts
const connection = { host: 'localhost', port: 6379 };

// Producer
QueueProducerModule.forRootAsync({
  useFactory: () => new BullMqProducerAdapter({ connection }),
});

// Consumer — BullMQ workers need a connection with maxRetriesPerRequest: null
QueueConsumerModule.forRootAsync({
  useFactory: () =>
    new BullMqConsumerAdapter({
      connection: { ...connection, maxRetriesPerRequest: null },
      concurrency: 10,
    }),
  consumers: [{ queue: 'orders', handler: OrdersHandler }],
});
```

**Job ↔ message mapping.** `send`/`dispatch` enqueue a job via `queue.add`. BullMQ
jobs have no header slot, so the adapter wraps the message as
`{ payload, headers }` job data and unwraps it on consume; `ctx.messageId` is the
BullMQ job id and `ctx.deliveryCount` is `attemptsMade + 1`. The producer closes its
queues on `OnModuleDestroy`. The shared `delay`/`priority` delivery options map
straight onto BullMQ job options. Every job is enqueued under a single job name
(`'message'` by default, overridable via the `jobName` option) — the worker
processes all names, so this only affects the BullMQ dashboard label.

**Richer job options — `addJob`.** For BullMQ-specific options beyond the shared
tier (`attempts`, `backoff`, `jobId`, `lifo`, `removeOnComplete`, …), inject the
concrete `BullMqProducerAdapter` and use the dedicated extension:

```ts
await producer.addJob({
  queue: 'orders',
  payload: { id: 1 },
  options: { attempts: 5, backoff: { type: 'exponential', delay: 1000 } },
});
```

**Acknowledgment is emulated.** BullMQ has no ack/nack — a job *completes* when
its processor resolves and *fails* (and retries per the job's `attempts`) when
the processor throws. The adapter maps the context contract onto that:

| Handler action | BullMQ outcome |
|---|---|
| resolves (or `ctx.ack()`) | job completes |
| throws | processor rethrows → job fails (retries if attempts remain) |
| `ctx.nack()` (requeue, default) | processor throws → job fails (retries if attempts remain) |
| `ctx.nack({ requeue: false })` | processor throws `UnrecoverableError` → no further retries |

> **Retry caveat.** Whether a failed/nacked job is *retried* is governed by the
> job's `attempts` option, set at enqueue time. A job enqueued without `attempts`
> (plain `send`/`dispatch`) defaults to a single attempt — so `nack({ requeue:
> true })` and a plain throw both fail it without retrying. Enqueue with
> `addJob({ options: { attempts } })` to make retries (and thus `requeue: true`)
> meaningful. `requeue: false` always prevents retries via `UnrecoverableError`.

## Error Codes

| Class | Code | Meaning |
|---|---|---|
| `QueueProducerError` | `QUEUE_PRODUCER_SEND_FAILED` | `send()` failed |
| `QueueProducerError` | `QUEUE_PRODUCER_DISPATCH_FAILED` | `dispatch()` failed |
| `QueueProducerError` | `QUEUE_PRODUCER_CONNECTION_FAILED` | broker connection failed |
| `QueueProducerError` | `QUEUE_PRODUCER_UNSUPPORTED_OPTION` | a delivery option the adapter can't honor |
| `QueueConsumerError` | `QUEUE_CONSUMER_CONSUME_FAILED` | consuming a message failed |
| `QueueConsumerError` | `QUEUE_CONSUMER_ACK_FAILED` | acknowledging failed |
| `QueueConsumerError` | `QUEUE_CONSUMER_NACK_FAILED` | negative-acknowledging failed |

## Reuse

**What lifts.** `abstract/` — the producer and consumer contracts and their
dynamic modules — is a self-contained unit you can copy into another project.
It needs `src/common/observability/logger/` alongside it:
`LoggerService`/`NestLoggerAdapter` are imported by the producer and consumer
services and modules. Its `tests/` folder mostly travels with it too —
`queue-producer.module.unit.spec.ts` and `queue-consumer.module.unit.spec.ts`
need only that same logger import. Copy the one adapter directory you
actually need next to it — each adapter has its own extra dependency:
`bullmq-adapter/` needs the `bullmq` package plus a Redis config scope
(`src/redis.scope.ts`, or your own),
`rabbitmq-adapter/` needs `amqplib` plus its own RabbitMQ scope, `sqs-adapter/`
needs `@aws-sdk/client-sqs`. You do not need all three — pick the broker you
use.

**What to do instead.** Copy `abstract/` and `src/common/observability/logger/`,
plus the adapter directory (or directories) you need, into your project. Then
write your own thin wiring module — a small `@Module` that calls
`QueueProducerModule.forRootAsync(...)`/`QueueConsumerModule.forRootAsync(...)`
with your own adapter and your own config, the same shape `src/app.module.ts`
uses for BullMQ here. Do not copy a domain module's `QueueConsumerHandler`
alongside it — write your own for whatever you're actually consuming.
