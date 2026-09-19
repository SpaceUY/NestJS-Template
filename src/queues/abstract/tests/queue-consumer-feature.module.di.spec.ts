/**
 * Compiles the real Nest module graph (unlike the shape-only `.unit.spec`
 * tests elsewhere in this module) to catch DI-wiring mistakes Nest only
 * surfaces on actual resolution.
 *
 * This is also the module's executable example: it is the exact shape
 * `src/queues/README.md` tells a consuming project to use — a global root
 * registration built from a config scope, plus a domain module that declares
 * its own handler and registers it with `forFeature`.
 */
import { Inject, Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { QueueConsumerModule } from '../consumer/queue-consumer.module';
import { QueueConsumerAdapter } from '../consumer/queue-consumer.adapter';
import { QueueConsumerHandler } from '../consumer/queue-consumer.handler';
import { MessageContext } from '../consumer/queue-consumer.interfaces';
import { BullMqConsumerAdapter } from '../../bullmq-adapter/bullmq-consumer.adapter';
import { LoggerService } from '../../../common/observability/logger/abstract/logger.service';
import { LoggerAbstractModule } from '../../../common/observability/logger/abstract/logger-abstract.module';
import { NestLoggerAdapter } from '../../../common/observability/logger/nest-adapter/nest-logger.adapter';
import { ConfigProviderAbstractModule } from '../../../config-provider/abstract/config-provider-abstract.module';
import { ConfigProviderService } from '../../../config-provider/abstract/config-provider.service';
import { configSources as from } from '../../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../../config-provider/abstract/define-config-scope.util';

// The BullMQ worker is only constructed inside startConsuming, and ioredis
// connects lazily, so the graph compiles and initialises without a live Redis.
jest.mock('bullmq');

const QUEUE = 'invoices';

/**
 * Stands in for the app-root Redis scope. Declared here rather than imported
 * so this spec exercises no file outside `src/queues/` and its two companions.
 */
type QueuesTestScopeConfig = { host: string; port: number };

const queuesTestScope = defineConfigScope<QueuesTestScopeConfig>(
  'queuesTest',
  { host: from.env('REDIS_HOST'), port: from.env('REDIS_PORT') },
  (raw) => ({
    host: String(raw.host ?? 'localhost'),
    port: Number(raw.port ?? 6379),
  }),
);

/** In-memory config source, so no .env or live provider is involved. */
class StubConfigAdapter extends ConfigProviderService {
  constructor(private readonly store: Record<string, string>) {
    super();
  }

  async get(key: string): Promise<string | undefined> {
    return this.store[key];
  }

  async getOrThrow(key: string): Promise<string> {
    const value = this.store[key];
    if (value === undefined) throw new Error(`Key "${key}" not found`);
    return value;
  }
}

/**
 * A non-global collaborator the handler needs. It is provided by the domain
 * module below and by nothing else — if `forFeature` provided the handler
 * itself, this dependency would be unresolvable and the graph would not
 * compile. That is the regression this spec exists to guard.
 */
@Injectable()
class InvoiceRecipients {
  getRecipients(): string[] {
    return ['billing@spacedev.io'];
  }
}

@Injectable()
class InvoiceProcessor extends QueueConsumerHandler<{ invoiceId: string }> {
  readonly seen: string[] = [];

  constructor(
    private readonly recipients: InvoiceRecipients,
    @Inject(queuesTestScope.KEY)
    private readonly config: QueuesTestScopeConfig,
  ) {
    super();
  }

  async handle(
    payload: { invoiceId: string },
    ctx: MessageContext,
  ): Promise<void> {
    this.seen.push(`${payload.invoiceId}@${this.config.host}`);
    // Explicit ack (rather than relying on the adapter's implicit ack on
    // resolve) so the DI-graph test can assert this exact `ctx` — the one
    // the feature module's bound callback was actually invoked with — was
    // delivered to this handler instance.
    await ctx.ack();
  }

  recipientCount(): number {
    return this.recipients.getRecipients().length;
  }
}

/**
 * The domain module: it owns its handler and its handler's collaborator, and
 * registers the binding with forFeature. Nothing in `src/queues/` names either
 * class.
 */
@Module({
  imports: [
    QueueConsumerModule.forFeature([
      { queue: QUEUE, handler: InvoiceProcessor },
    ]),
  ],
  providers: [InvoiceProcessor, InvoiceRecipients],
})
class InvoicingModule {}

describe('QueueConsumerModule.forFeature (DI graph)', () => {
  let moduleRef: TestingModule;
  // Captured before `init()` so it records the real call `forFeature`'s
  // `QueueConsumerFeatureModule.onModuleInit` makes during startup, rather
  // than a call the test triggers itself.
  let startConsumingSpy: jest.SpyInstance;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        LoggerAbstractModule.forRoot({
          adapter: NestLoggerAdapter,
          isGlobal: true,
        }),
        ConfigProviderAbstractModule.forRoot({
          isGlobal: true,
          sources: {
            env: {
              useValue: new StubConfigAdapter({
                REDIS_HOST: 'localhost',
                REDIS_PORT: '6379',
              }),
            },
          },
          scopes: [queuesTestScope],
        }),
        QueueConsumerModule.forRootAsync({
          isGlobal: true,
          inject: [queuesTestScope.KEY],
          useFactory: (config: QueuesTestScopeConfig) =>
            new BullMqConsumerAdapter({
              connection: { host: config.host, port: config.port },
            }),
        }),
        InvoicingModule,
      ],
    }).compile();

    const adapter = moduleRef.get<BullMqConsumerAdapter>(QueueConsumerAdapter, {
      strict: false,
    });
    startConsumingSpy = jest.spyOn(adapter, 'startConsuming');

    await moduleRef.init();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('wires the adapter the root factory built from the config scope', () => {
    const adapter = moduleRef.get<QueueConsumerAdapter>(QueueConsumerAdapter, {
      strict: false,
    });

    expect(adapter).toBeInstanceOf(BullMqConsumerAdapter);
  });

  it('gives the adapter the container logger, tagged with its class name', () => {
    const adapter = moduleRef.get<QueueConsumerAdapter>(QueueConsumerAdapter, {
      strict: false,
    });
    const logger = (adapter as unknown as { logger: LoggerService }).logger;

    expect(logger).toBeInstanceOf(NestLoggerAdapter);
    expect((logger as unknown as { context: string }).context).toBe(
      'BullMqConsumerAdapter',
    );
  });

  it('resolves the handler from the domain module with its own dependencies', () => {
    // Both of these come from InvoicingModule, not from any queues module. If
    // forFeature provided the handler the way the root path does, neither the
    // collaborator nor the config scope would resolve here.
    const handler = moduleRef.get<InvoiceProcessor>(InvoiceProcessor, {
      strict: false,
    });

    expect(handler).toBeInstanceOf(InvoiceProcessor);
    expect(handler.recipientCount()).toBe(1);
  });

  it('starts consuming the registered queue with the handler bound', async () => {
    // The worker was created during init(); assert against the mocked bullmq
    // Worker constructor that the root's connection config reached it.
    const { Worker } = jest.requireMock('bullmq') as {
      Worker: jest.Mock;
    };
    expect(Worker).toHaveBeenCalledWith(
      QUEUE,
      expect.any(Function),
      expect.objectContaining({
        connection: { host: 'localhost', port: 6379 },
      }),
    );

    // `forFeature`'s feature module calls `adapter.startConsuming(queue,
    // instance.handle.bind(instance))` — capture that exact call (recorded
    // before `init()` above) and invoke the callback it handed the adapter,
    // rather than calling `handle` on the handler directly. This is what
    // would fail if `QueueConsumerFeatureModule` bound the wrong handler.
    expect(startConsumingSpy).toHaveBeenCalledWith(QUEUE, expect.any(Function));
    const [, callback] = startConsumingSpy.mock.calls[0] as [
      string,
      (payload: unknown, ctx: MessageContext) => Promise<void>,
    ];

    const ctx = {
      headers: {},
      ack: jest.fn(async () => {}),
      nack: jest.fn(async () => {}),
    } as MessageContext;
    await callback({ invoiceId: 'INV-1' }, ctx);

    const handler = moduleRef.get<InvoiceProcessor>(InvoiceProcessor, {
      strict: false,
    });
    expect(handler.seen).toEqual(['INV-1@localhost']);
    expect(ctx.ack).toHaveBeenCalledTimes(1);
  });
});
