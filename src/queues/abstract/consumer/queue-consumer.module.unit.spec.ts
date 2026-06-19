/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueueConsumerModule } from './queue-consumer.module';
import { QueueConsumerAdapter } from './queue-consumer.adapter';
import { QueueConsumerHandler } from './queue-consumer.handler';
import { MessageContext } from './queue-consumer.interfaces';
import { LoggerService } from '../../../common/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../../common/logger/nest-adapter/nest-logger.adapter';

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

function findAdapterProvider(moduleRef: any): any {
  return (moduleRef.providers as any[]).find(
    (p) => p.provide === QueueConsumerAdapter,
  );
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

      const handlerProviders = (moduleRef.providers as any[]).filter(
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
      expect((instance as any).logger).toBe(mockLogger);
    });

    it('falls back to NestLoggerAdapter when no logger is provided', () => {
      const moduleRef = QueueConsumerModule.forRoot({
        adapter: MockConsumerAdapter,
        consumers: [],
      });

      const instance = findAdapterProvider(moduleRef).useFactory(undefined);

      expect((instance as any).logger).toBeInstanceOf(NestLoggerAdapter);
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

      const adapter = app.get(QueueConsumerAdapter) as any;
      expect(adapter.startConsuming).toHaveBeenCalledTimes(2);
      expect(adapter.startConsuming.mock.calls.map((c: any[]) => c[0])).toEqual(
        ['orders', 'notifications'],
      );

      await app.close();

      expect(adapter.stopConsuming).toHaveBeenCalledTimes(2);
      expect(adapter.stopConsuming.mock.calls.map((c: any[]) => c[0])).toEqual([
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

      const adapter = app.get(QueueConsumerAdapter) as any;
      const handler = app.get(OrdersHandler);
      const callback = adapter.startConsuming.mock.calls[0][1];

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
});
