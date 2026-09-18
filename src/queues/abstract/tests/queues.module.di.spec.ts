/**
 * Compiles the real Nest module graph (unlike the shape-only `.unit.spec` tests
 * elsewhere in this module) to catch DI-wiring mistakes Nest only surfaces on
 * actual resolution. `QueuesModule` leans on three things a shape-only test
 * cannot reach: the `BullMqProducerAdapter` alias over a global dynamic module,
 * handler instantiation inside `QueueConsumerModule`'s own injector scope, and
 * the `imports` array carrying that handler's non-global dependencies.
 *
 * Replaces the equivalent coverage master had in
 * `queue-abstract.module.di.spec.ts`, which was removed when the two queue
 * designs were reconciled.
 */
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { QueuesModule } from '../../queues.module';
import { QueueProducerService } from '../producer/queue-producer.service';
import { BullMqProducerAdapter } from '../../bullmq-adapter/bullmq-producer.adapter';
import { SpaceshipNotificationProcessor } from '../../../spaceship/notification/notification.processor';
import { EmailService } from '../../../email/abstract/email.service';
import { TemplateService } from '../../../templating/abstract/template.service';
import { LoggerService } from '../../../common/observability/logger/abstract/logger.service';
import { LoggerAbstractModule } from '../../../common/observability/logger/abstract/logger-abstract.module';
import { NestLoggerAdapter } from '../../../common/observability/logger/nest-adapter/nest-logger.adapter';
import { ConfigProviderAbstractModule } from '../../../config-provider/abstract/config-provider-abstract.module';
import { ConfigProviderService } from '../../../config-provider/abstract/config-provider.service';
import { redisScope } from '../../../redis.scope';
import { rabbitmqScope } from '../../rabbitmq-adapter/config/rabbitmq.scope';
import { notificationRecipientsScope } from '../../../spaceship/notification/config/notification-recipients.scope';
import { emailScope } from '../../../email/config/email.scope';

// Neither adapter connects on construction — BullMQ's ioredis connection is
// lazy and the worker is only created when the consumer module starts — so the
// graph compiles without a live Redis. `init()` is never called here.
jest.mock('bullmq');

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
 * In the real app EmailService and TemplateService reach the handler through
 * global modules. This stands in for both, so the test stays about queue
 * wiring rather than booting the email and templating stacks.
 */
@Global()
@Module({
  providers: [
    {
      provide: EmailService,
      useValue: { sendEmail: jest.fn(), sendEmailBatch: jest.fn() },
    },
    {
      provide: TemplateService,
      useValue: { compile: jest.fn().mockResolvedValue('<html></html>') },
    },
  ],
  exports: [EmailService, TemplateService],
})
class StubCollaboratorsModule {}

const CONFIG: Record<string, string> = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  REDIS_PASSWORD: '',
  RABBITMQ_URL: 'amqp://localhost:5672',
  NOTIFICATION_RECIPIENTS: 'ops@spacedev.io',
  EMAIL_FROM: 'noreply@spacedev.io',
  EMAIL_ADAPTER: 'CONSOLE',
};

describe('QueuesModule (DI graph)', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        LoggerAbstractModule.forRoot({
          adapter: NestLoggerAdapter,
          isGlobal: true,
        }),
        ConfigProviderAbstractModule.forRoot({
          isGlobal: true,
          sources: { env: { useValue: new StubConfigAdapter(CONFIG) } },
          scopes: [
            redisScope,
            rabbitmqScope,
            notificationRecipientsScope,
            emailScope,
          ],
        }),
        StubCollaboratorsModule,
        QueuesModule,
      ],
    }).compile();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('resolves QueueProducerService to the wired BullMQ adapter', () => {
    const producer = moduleRef.get<QueueProducerService>(QueueProducerService, {
      strict: false,
    });

    expect(producer).toBeInstanceOf(BullMqProducerAdapter);
  });

  it('resolves the BullMqProducerAdapter alias to that same instance', () => {
    const abstract = moduleRef.get<QueueProducerService>(QueueProducerService, {
      strict: false,
    });
    const concrete = moduleRef.get<BullMqProducerAdapter>(
      BullMqProducerAdapter,
      {
        strict: false,
      },
    );

    expect(concrete).toBe(abstract);
    // The producer depends on this method existing; the abstract token does not
    // expose it.
    expect(typeof concrete.addJob).toBe('function');
  });

  it('gives the producer adapter the container logger, tagged with its class name', () => {
    const producer = moduleRef.get<BullMqProducerAdapter>(
      BullMqProducerAdapter,
      {
        strict: false,
      },
    );

    const logger = (producer as unknown as { logger: LoggerService }).logger;

    expect(logger).toBeInstanceOf(NestLoggerAdapter);
    expect((logger as unknown as { context: string }).context).toBe(
      'BullMqProducerAdapter',
    );
  });

  it('refuses to alias BullMqProducerAdapter onto a producer from another broker', () => {
    // Guards the swap the module guide invites: changing the wired adapter to
    // RabbitMQ/SQS still compiles, and without this the failure would surface
    // as `addJob is not a function` on the first enqueue in production.
    const providers = Reflect.getMetadata('providers', QueuesModule) as Array<{
      provide: unknown;
      useFactory?: (producer: QueueProducerService) => unknown;
    }>;
    const aliasProvider = providers.find(
      (p) => p.provide === BullMqProducerAdapter,
    );

    class NotBullMq extends QueueProducerService {
      async send(): Promise<void> {}
      async dispatch(): Promise<void> {}
    }

    expect(aliasProvider?.useFactory).toBeDefined();
    expect(() => aliasProvider!.useFactory!(new NotBullMq())).toThrow(
      /wired producer is NotBullMq/,
    );
  });

  it('instantiates the registered consumer handler with its own dependencies', () => {
    // The handler lives in QueueConsumerModule's scope, not the domain
    // module's, so its non-global deps must be reachable from there. If the
    // `imports` array in queues.module.ts were dropped, this resolution throws.
    const handler = moduleRef.get<SpaceshipNotificationProcessor>(
      SpaceshipNotificationProcessor,
      { strict: false },
    );

    expect(handler).toBeInstanceOf(SpaceshipNotificationProcessor);
    expect(typeof handler.handle).toBe('function');
  });
});
