# Queues Module

Provider-agnostic message queues for NestJS using the same adapter pattern as
`cache`, `email`, `cloud-storage`, and `config-provider`. No
`@nestjs/microservices`, no decorators — adapters are built directly against raw
broker libraries (e.g. `amqplib`, AWS SDK v3).

The module is split into two **independent** dynamic modules, each with its own
connection to the broker:

- **`QueueSenderModule`** — publishing messages.
- **`QueueConsumerModule`** — consuming messages.

Only the abstract contracts ship here. Concrete broker adapters live in
application code.

## Directory Structure

```text
src/queues/
├── abstract/
│   ├── sender/
│   │   ├── queue-sender.service.ts       # abstract QueueSenderService (DI token)
│   │   ├── queue-sender.module.ts        # QueueSenderModule
│   │   ├── queue-sender.interfaces.ts    # QueueEnvelope, module options
│   │   └── queue-sender.error.ts         # QueueSenderError
│   └── consumer/
│       ├── queue-consumer.adapter.ts     # abstract QueueConsumerAdapter (DI token)
│       ├── queue-consumer.handler.ts     # abstract QueueConsumerHandler<T>
│       ├── queue-consumer.module.ts      # QueueConsumerModule
│       ├── queue-consumer.interfaces.ts  # MessageContext, ConsumerRegistration, options
│       └── queue-consumer.error.ts       # QueueConsumerError
└── README.md
```

## Core Contracts

### Sender — `QueueSenderService`

The abstract class doubles as the NestJS injection token. Inject it to publish.

- `send(queue, payload)` — fire-and-forget shorthand.
- `dispatch(envelope)` — advanced path when headers/envelope metadata are needed.

```ts
export interface QueueEnvelope {
  queue: string;
  payload: unknown;
  headers?: Record<string, string>;
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

Handlers are registered as NestJS providers, so they can inject any service from
the container through their constructor.

### `MessageContext`

Passed to every `handle()` call. Ignored for simple cases; used directly for
explicit acknowledgment control.

```ts
export interface MessageContext {
  readonly messageId?: string;
  readonly headers: Record<string, string>;
  ack(): Promise<void>;
  nack(opts?: { requeue?: boolean }): Promise<void>;
}
```

## Registration

### Sender

```ts
// Synchronous — adapter has a no-arg constructor
QueueSenderModule.forRoot({
  adapter: MyBrokerSenderAdapter,
  isGlobal: true,
});

// Async — adapter config injected from DI
QueueSenderModule.forRootAsync({
  inject: [someConfig.KEY],
  useFactory: (config) => new MyBrokerSenderAdapter({ url: config.brokerUrl }),
  isGlobal: true,
});
```

### Consumer

All consumers are declared in one place via the `consumers` array. The adapter
config can come from DI (`forRootAsync`), but the consumer class references stay
synchronous.

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
`setLogger()` on the adapter instance, identical to the other abstract modules.

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

## What Adapters Must Implement

### Sender adapter

- Extend `QueueSenderService`.
- Implement `send(queue, payload)` and `dispatch(envelope)`.
- Accept config via constructor; use `forRootAsync` for DI-sourced config.
- Throw `QueueSenderError` on failures.

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
(`SqsSenderAdapter` + `SqsConsumerAdapter`). Each builds its own `SQSClient`, so
the two modules keep independent connections. Credentials are optional — prefer
IAM roles in remote environments and only pass explicit keys for local
development (same convention as the secrets-manager adapter).

```ts
// Sender
QueueSenderModule.forRoot({
  adapter: class extends SqsSenderAdapter {
    constructor() {
      super({ region: 'us-east-1' });
    }
  },
});

// ...or, with DI-sourced config:
QueueSenderModule.forRootAsync({
  inject: [awsConfig.KEY],
  useFactory: (aws) => new SqsSenderAdapter({ region: aws.region }),
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
`QueueSenderError(DISPATCH_FAILED)`.

```ts
await sender.dispatch({
  queue: 'orders.fifo',
  payload: { id: 1 },
  headers: { MessageGroupId: 'tenant-42', traceId: 'abc' },
});
```

**Consuming.** SQS has no push delivery, so `SqsConsumerAdapter` runs a
long-polling worker loop per queue (configurable `waitTimeSeconds`,
`maxNumberOfMessages`, `visibilityTimeout`). `stopConsuming` aborts the loop via
an `AbortController`. Implicit ack maps to `DeleteMessage`; implicit/explicit
nack maps to `ChangeMessageVisibility`.

**SQS nack limitation.** SQS has no "discard" primitive. `ctx.nack()` (requeue,
the default) sets the message's visibility timeout to `0` for immediate
redelivery; `ctx.nack({ requeue: false })` is a no-op — the message simply
reappears after its visibility timeout lapses, going to a dead-letter queue if
the queue has a redrive policy. This is an SQS constraint, not an adapter
shortcut.

## Error Codes

| Class | Code | Meaning |
|---|---|---|
| `QueueSenderError` | `QUEUE_SENDER_SEND_FAILED` | `send()` failed |
| `QueueSenderError` | `QUEUE_SENDER_DISPATCH_FAILED` | `dispatch()` failed |
| `QueueSenderError` | `QUEUE_SENDER_CONNECTION_FAILED` | broker connection failed |
| `QueueConsumerError` | `QUEUE_CONSUMER_CONSUME_FAILED` | consuming a message failed |
| `QueueConsumerError` | `QUEUE_CONSUMER_ACK_FAILED` | acknowledging failed |
| `QueueConsumerError` | `QUEUE_CONSUMER_NACK_FAILED` | negative-acknowledging failed |
| `QueueConsumerError` | `QUEUE_CONSUMER_HANDLER_ERROR` | the handler threw |
