import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueueConsumerModule } from '../consumer/queue-consumer.module';
import { QueueConsumerAdapter } from '../consumer/queue-consumer.adapter';
import { QueueConsumerHandler } from '../consumer/queue-consumer.handler';
import { MessageContext } from '../consumer/queue-consumer.interfaces';
import { LoggerService } from '../../../common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../../common/observability/logger/nest-adapter/nest-logger.adapter';
import {
  QueueConsumerFeatureModule,
  QUEUE_FEATURE_CONSUMERS,
} from '../consumer/queue-consumer-feature.module';

class MockConsumerAdapter extends QueueConsumerAdapter {
  startConsuming = jest.fn(async () => {});
  stopConsuming = jest.fn(async () => {});
}

@Injectable()
class OrdersHandler extends QueueConsumerHandler {
  handle = jest.fn(async () => {});
}

@Injectable()
class NotificationsHandler extends QueueConsumerHandler {
  handle = jest.fn(async () => {});
}

@Injectable()
class Dependency {
  readonly value = 'injected';
}

@Module({ providers: [Dependency], exports: [Dependency] })
class DependencyModule {}

@Injectable()
class HandlerWithDep extends QueueConsumerHandler {
  constructor(readonly dep: Dependency) {
    super();
  }

  handle = jest.fn(async () => {});
}

const ctx: MessageContext = {
  headers: {},
  ack: jest.fn(async () => {}),
  nack: jest.fn(async () => {}),
};

/** A provider entry as these tests read it back off a DynamicModule. */
type ProviderEntry = {
  provide?: unknown;
  inject?: unknown[];
  useFactory: (...args: unknown[]) => unknown;
};

/** The consumer adapter as the container hands it back: every method a mock. */
type ResolvedMockAdapter = {
  startConsuming: jest.Mock;
  stopConsuming: jest.Mock;
};

/** Reads the private `logger` the module hands the adapter. */
const loggerOf = (instance: unknown): unknown =>
  (instance as { logger?: unknown }).logger;

function findAdapterProvider(moduleRef: {
  providers?: unknown[];
}): ProviderEntry {
  return ((moduleRef.providers ?? []) as ProviderEntry[]).find(
    (p) => p.provide === QueueConsumerAdapter,
  ) as ProviderEntry;
}

describe('QueueConsumerModule', () => {
  describe('registration metadata', () => {
    it('forRoot exports the adapter, registers handlers + consumers, and reflects isGlobal', () => {
      const moduleRef = QueueConsumerModule.forRoot({
        adapter: MockConsumerAdapter,
        consumers: [{ queue: 'orders', handler: OrdersHandler }],
        isGlobal: true,
      });

      expect(moduleRef.module).toBe(QueueConsumerModule);
      expect(moduleRef.global).toBe(true);
      expect(moduleRef.exports).toContain(QueueConsumerAdapter);
      expect(moduleRef.providers).toContain(OrdersHandler);
      expect(moduleRef.providers).toContainEqual({
        provide: 'QUEUE_CONSUMERS',
        useValue: [{ queue: 'orders', handler: OrdersHandler }],
      });
    });

    it('defaults global to false', () => {
      const moduleRef = QueueConsumerModule.forRoot({
        adapter: MockConsumerAdapter,
        consumers: [],
      });

      expect(moduleRef.global).toBe(false);
    });

    it('registers each handler class only once', () => {
      const moduleRef = QueueConsumerModule.forRoot({
        adapter: MockConsumerAdapter,
        consumers: [
          { queue: 'a', handler: OrdersHandler },
          { queue: 'b', handler: OrdersHandler },
        ],
      });

      const handlerProviders = (moduleRef.providers ?? []).filter(
        (p) => p === OrdersHandler,
      );
      expect(handlerProviders).toHaveLength(1);
    });

    it('builds the adapter and calls setLogger when a logger is provided', () => {
      const mockLogger = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        setContext: jest.fn(),
        withTelemetry: jest.fn(),
      } as unknown as LoggerService;

      const moduleRef = QueueConsumerModule.forRoot({
        adapter: MockConsumerAdapter,
        consumers: [],
      });

      const instance = findAdapterProvider(moduleRef).useFactory(mockLogger);

      expect(instance).toBeInstanceOf(MockConsumerAdapter);
      expect(loggerOf(instance)).toBe(mockLogger);
    });

    it('falls back to NestLoggerAdapter when no logger is provided', () => {
      const moduleRef = QueueConsumerModule.forRoot({
        adapter: MockConsumerAdapter,
        consumers: [],
      });

      const instance = findAdapterProvider(moduleRef).useFactory(undefined);

      expect(loggerOf(instance)).toBeInstanceOf(NestLoggerAdapter);
    });

    it('forRootAsync prepends the optional LoggerService to user inject tokens', () => {
      const depToken = 'SOME_DEP';
      const moduleRef = QueueConsumerModule.forRootAsync({
        inject: [depToken],
        useFactory: () => new MockConsumerAdapter(),
        consumers: [],
      });

      expect(findAdapterProvider(moduleRef).inject).toEqual([
        { token: LoggerService, optional: true },
        depToken,
      ]);
    });
  });

  describe('lifecycle', () => {
    it('starts consuming each queue on init and stops on destroy', async () => {
      const app = await Test.createTestingModule({
        imports: [
          QueueConsumerModule.forRoot({
            adapter: MockConsumerAdapter,
            consumers: [
              { queue: 'orders', handler: OrdersHandler },
              { queue: 'notifications', handler: NotificationsHandler },
            ],
          }),
        ],
      }).compile();

      await app.init();

      const adapter = app.get(
        QueueConsumerAdapter,
      ) as unknown as ResolvedMockAdapter;
      expect(adapter.startConsuming).toHaveBeenCalledTimes(2);
      expect(adapter.startConsuming.mock.calls.map((call) => call[0])).toEqual([
        'orders',
        'notifications',
      ]);

      await app.close();

      expect(adapter.stopConsuming).toHaveBeenCalledTimes(2);
      expect(adapter.stopConsuming.mock.calls.map((call) => call[0])).toEqual([
        'orders',
        'notifications',
      ]);
    });

    it('wires the callback to the resolved handler instance', async () => {
      const app = await Test.createTestingModule({
        imports: [
          QueueConsumerModule.forRoot({
            adapter: MockConsumerAdapter,
            consumers: [{ queue: 'orders', handler: OrdersHandler }],
          }),
        ],
      }).compile();

      await app.init();

      const adapter = app.get(
        QueueConsumerAdapter,
      ) as unknown as ResolvedMockAdapter;
      const handler = app.get(OrdersHandler);
      const callback = adapter.startConsuming.mock.calls[0][1] as (
        payload: unknown,
        ctx: MessageContext,
      ) => Promise<void>;

      await callback({ id: 1 }, ctx);

      expect(handler.handle).toHaveBeenCalledWith({ id: 1 }, ctx);

      await app.close();
    });

    it('resolves handlers through DI with their dependencies injected', async () => {
      const app = await Test.createTestingModule({
        imports: [
          QueueConsumerModule.forRootAsync({
            imports: [DependencyModule],
            useFactory: () => new MockConsumerAdapter(),
            consumers: [{ queue: 'orders', handler: HandlerWithDep }],
          }),
        ],
      }).compile();

      await app.init();

      const handler = app.get(HandlerWithDep);
      expect(handler.dep).toBeInstanceOf(Dependency);
      expect(handler.dep.value).toBe('injected');

      await app.close();
    });
  });

  describe('forFeature', () => {
    it('returns a QueueConsumerFeatureModule carrying only the registration list', () => {
      const moduleRef = QueueConsumerModule.forFeature([
        { queue: 'orders', handler: OrdersHandler },
      ]);

      expect(moduleRef.module).toBe(QueueConsumerFeatureModule);
      expect(moduleRef.providers).toContainEqual({
        provide: QUEUE_FEATURE_CONSUMERS,
        useValue: [{ queue: 'orders', handler: OrdersHandler }],
      });
      // The handler is deliberately NOT provided here. The domain module owns
      // it, so its dependencies resolve in the domain module's injector — that
      // is the entire point of this path.
      expect(moduleRef.providers).not.toContain(OrdersHandler);
    });

    it('defaults consumers to an empty list when forRoot omits them', () => {
      const moduleRef = QueueConsumerModule.forRoot({
        adapter: MockConsumerAdapter,
      });

      expect(moduleRef.providers).toContainEqual({
        provide: 'QUEUE_CONSUMERS',
        useValue: [],
      });
    });

    it('defaults consumers to an empty list when forRootAsync omits them', () => {
      const moduleRef = QueueConsumerModule.forRootAsync({
        useFactory: () => new MockConsumerAdapter(),
      });

      expect(moduleRef.providers).toContainEqual({
        provide: 'QUEUE_CONSUMERS',
        useValue: [],
      });
    });
  });

  describe('forFeature lifecycle', () => {
    @Module({
      imports: [
        DependencyModule,
        QueueConsumerModule.forFeature([
          { queue: 'invoices', handler: HandlerWithDep },
        ]),
      ],
      providers: [HandlerWithDep],
    })
    class InvoicesModule {}

    it('starts, invokes and stops a consumer whose handler lives in the domain module', async () => {
      const testing = await Test.createTestingModule({
        imports: [
          QueueConsumerModule.forRoot({
            adapter: MockConsumerAdapter,
            isGlobal: true,
          }),
          InvoicesModule,
        ],
      }).compile();

      await testing.init();

      const adapter = testing.get<MockConsumerAdapter>(QueueConsumerAdapter, {
        strict: false,
      });
      expect(adapter.startConsuming).toHaveBeenCalledWith(
        'invoices',
        expect.any(Function),
      );

      // The handler resolved from the domain module's own injector, so its
      // non-global dependency was satisfied there. Under the forRoot path this
      // only worked when the caller hand-copied DependencyModule into the
      // registration's `imports` array.
      const handler = testing.get<HandlerWithDep>(HandlerWithDep, {
        strict: false,
      });
      expect(handler.dep.value).toBe('injected');

      // The callback handed to the adapter is bound to that same instance.
      // Read through the mock view: `adapter` is declared as
      // `MockConsumerAdapter`, whose `startConsuming` field infers a
      // zero-argument mock signature from its own initializer, not the
      // two-argument signature `QueueConsumerAdapter` actually declares.
      const callback = (adapter as unknown as ResolvedMockAdapter)
        .startConsuming.mock.calls[0][1] as (
        payload: unknown,
        ctx: MessageContext,
      ) => Promise<void>;
      await callback({ id: 1 }, ctx);
      expect(handler.handle).toHaveBeenCalledWith({ id: 1 }, ctx);

      await testing.close();
      expect(adapter.stopConsuming).toHaveBeenCalledWith('invoices');
    });
  });
});
