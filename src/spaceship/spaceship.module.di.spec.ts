/**
 * Compiles the real Nest module graph for the reference domain module, which
 * the `.unit.spec` files beside it deliberately do not: they replace every
 * collaborator with a jest object, so they cannot see a wiring mistake.
 *
 * Three things here fail only on actual resolution, and all three are what a
 * new domain module copies:
 *
 *  - the handler is registered with `QueueConsumerModule.forFeature` but
 *    provided by this module, so its non-global collaborator
 *    (`NotificationRecipientsProvider`) has to resolve in this module's own
 *    injector;
 *  - the guarded `BullMqProducerAdapter` alias has to find a BullMQ producer
 *    behind the abstract token, and has to fail at startup when it does not;
 *  - the controller has to resolve with the service, the repository and the
 *    guard the `AuthModule` import brings in.
 */
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SpaceshipModule } from './spaceship.module';
import { SpaceshipController } from './spaceship.controller';
import { SpaceshipService } from './spaceship.service';
import { SpaceshipRepository } from './spaceship.repository';
import { SpaceshipNotificationQueueModule } from './notification/notification.module';
import { SpaceshipNotificationProducer } from './notification/notification.producer';
import { SpaceshipNotificationProcessor } from './notification/notification.processor';
import { NotificationRecipientsProvider } from './notification/notification-recipients.provider';
import { SPACESHIP_NOTIFICATION_QUEUE } from './notification/notification.constants';
import { spaceshipCacheScope } from './config/spaceship-cache.scope';
import { notificationRecipientsScope } from './notification/config/notification-recipients.scope';
import { Spaceship } from '../database/entities/spaceship.entity';
import { User } from '../database/entities/user.entity';
import { CacheService } from '../cache/abstract/cache.service';
import { EmailService } from '../email/abstract/email.service';
import { TemplateService } from '../templating/abstract/template.service';
import { emailScope } from '../email/config/email.scope';
import { jwtScope } from '../auth/config/jwt.scope';
import { googleScope } from '../auth/google/config/google.scope';
import { auth0Scope } from '../auth/auth0/config/auth0.scope';
import { LoggerAbstractModule } from '../common/observability/logger/abstract/logger-abstract.module';
import { NestLoggerAdapter } from '../common/observability/logger/nest-adapter/nest-logger.adapter';
import { ConfigProviderAbstractModule } from '../config-provider/abstract/config-provider-abstract.module';
import { ConfigProviderService } from '../config-provider/abstract/config-provider.service';
import { QueueProducerModule } from '../queues/abstract/producer/queue-producer.module';
import { QueueProducerService } from '../queues/abstract/producer/queue-producer.service';
import { QueueConsumerModule } from '../queues/abstract/consumer/queue-consumer.module';
import { QueueConsumerAdapter } from '../queues/abstract/consumer/queue-consumer.adapter';
import { BullMqProducerAdapter } from '../queues/bullmq-adapter/bullmq-producer.adapter';
import { BullMqConsumerAdapter } from '../queues/bullmq-adapter/bullmq-consumer.adapter';

// The BullMQ queue and worker are only constructed on first use, and ioredis
// connects lazily, so the graph compiles and initialises without a live Redis.
jest.mock('bullmq');

/** In-memory config source, so no .env and no live provider is involved. */
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

/** A producer for some other broker — used to prove the alias guard fires. */
class OtherBrokerProducerAdapter extends QueueProducerService {
  async send(): Promise<void> {}
  async dispatch(): Promise<void> {}
}

/**
 * Everything `src/app.module.ts` supplies from outside `src/spaceship/`: the
 * infrastructure abstractions, the email scope the processor reads its `from`
 * address from, and the auth scopes and `User` repository the `AuthModule`
 * import needs. Global, because that is how all of them are registered there.
 */
@Global()
@Module({
  providers: [
    {
      provide: CacheService,
      useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
    },
    { provide: EmailService, useValue: { sendEmailBatch: jest.fn() } },
    { provide: TemplateService, useValue: { compile: jest.fn() } },
    { provide: emailScope.KEY, useValue: { from: 'no-reply@spacedev.io' } },
    {
      provide: jwtScope.KEY,
      useValue: {
        secret: 'a-test-secret',
        expiresIn: '7d',
        ignoreExpiration: false,
      },
    },
    { provide: googleScope.KEY, useValue: { enabled: false } },
    { provide: auth0Scope.KEY, useValue: { enabled: false } },
    { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
    { provide: getRepositoryToken(Spaceship), useValue: { find: jest.fn() } },
  ],
  exports: [
    CacheService,
    EmailService,
    TemplateService,
    emailScope.KEY,
    jwtScope.KEY,
    googleScope.KEY,
    auth0Scope.KEY,
    getRepositoryToken(User),
    getRepositoryToken(Spaceship),
  ],
})
class AppContextStubModule {}

const platformModules = [
  LoggerAbstractModule.forRoot({
    adapter: NestLoggerAdapter,
    isGlobal: true,
  }),
  ConfigProviderAbstractModule.forRoot({
    isGlobal: true,
    sources: {
      env: {
        useValue: new StubConfigAdapter({
          NOTIFICATION_EMPLOYEE_EMAILS: 'first@example.com,second@example.com',
          SPACESHIP_LIST_CACHE_TTL_SECONDS: '60',
        }),
      },
    },
    scopes: [spaceshipCacheScope, notificationRecipientsScope],
  }),
  AppContextStubModule,
];

describe('SpaceshipModule (DI graph)', () => {
  let moduleRef: TestingModule;
  // Captured before `init()`, so it records the call the feature module's own
  // `onModuleInit` makes at startup rather than one the test triggers.
  let startConsumingSpy: jest.SpyInstance;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ...platformModules,
        QueueProducerModule.forRootAsync({
          isGlobal: true,
          useFactory: () =>
            new BullMqProducerAdapter({
              connection: { host: 'localhost', port: 6379 },
            }),
        }),
        QueueConsumerModule.forRootAsync({
          isGlobal: true,
          useFactory: () =>
            new BullMqConsumerAdapter({
              connection: { host: 'localhost', port: 6379 },
            }),
        }),
        SpaceshipModule,
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

  describe('the HTTP half', () => {
    it('resolves the controller with its service and repository', () => {
      expect(moduleRef.get(SpaceshipController)).toBeInstanceOf(
        SpaceshipController,
      );
      expect(moduleRef.get(SpaceshipService)).toBeInstanceOf(SpaceshipService);
      expect(moduleRef.get(SpaceshipRepository)).toBeInstanceOf(
        SpaceshipRepository,
      );
    });
  });

  describe('the background half', () => {
    it('exports the producer to the domain module that enqueues', () => {
      expect(moduleRef.get(SpaceshipNotificationProducer)).toBeInstanceOf(
        SpaceshipNotificationProducer,
      );
    });

    // The handler is bound by `forFeature` but provided here. If it were
    // provided by the queues module instead — the pre-`forFeature` shape —
    // its recipients provider would not resolve and this would not compile.
    it('resolves the processor together with its own non-global collaborator', () => {
      const processor = moduleRef.get(SpaceshipNotificationProcessor, {
        strict: false,
      });
      const recipients = moduleRef.get(NotificationRecipientsProvider, {
        strict: false,
      });

      expect(processor).toBeInstanceOf(SpaceshipNotificationProcessor);
      expect(recipients).toBeDefined();
    });

    it('starts consuming its own queue on startup', () => {
      expect(startConsumingSpy).toHaveBeenCalledWith(
        SPACESHIP_NOTIFICATION_QUEUE,
        expect.any(Function),
      );
    });

    it('reads the recipients the config scope parsed', async () => {
      const recipients = moduleRef.get<NotificationRecipientsProvider>(
        NotificationRecipientsProvider,
        { strict: false },
      );

      await expect(recipients.getRecipients()).resolves.toEqual([
        'first@example.com',
        'second@example.com',
      ]);
    });
  });

  describe('the guarded BullMQ alias', () => {
    it('resolves to the very producer the root registration wired', () => {
      const alias = moduleRef.get(BullMqProducerAdapter, { strict: false });
      const wired = moduleRef.get(QueueProducerService, { strict: false });

      expect(alias).toBe(wired);
    });

    // The whole point of the guard: a broker swap must break at startup, not
    // at the first `addJob` inside a request.
    it('refuses to start when another broker is wired', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            ...platformModules,
            QueueProducerModule.forRoot({
              adapter: OtherBrokerProducerAdapter,
              isGlobal: true,
            }),
            QueueConsumerModule.forRootAsync({
              isGlobal: true,
              useFactory: () =>
                new BullMqConsumerAdapter({
                  connection: { host: 'localhost', port: 6379 },
                }),
            }),
            SpaceshipNotificationQueueModule,
          ],
        }).compile(),
      ).rejects.toThrow(/OtherBrokerProducerAdapter/);
    });
  });
});
