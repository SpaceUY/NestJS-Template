/* eslint-disable @typescript-eslint/no-explicit-any */
import { QueueSenderModule } from './queue-sender.module';
import { QueueSenderService } from './queue-sender.service';
import { LoggerService } from '../../../common/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../../common/logger/nest-adapter/nest-logger.adapter';

class MockSenderAdapter extends QueueSenderService {
  send = jest.fn(async () => {});
  dispatch = jest.fn(async () => {});
}

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
  withTelemetry: jest.fn(),
} as unknown as LoggerService;

function findSenderProvider(moduleRef: any): any {
  return (moduleRef.providers as any[]).find(
    (p) => p.provide === QueueSenderService,
  );
}

describe('QueueSenderModule', () => {
  describe('forRoot', () => {
    it('registers and exports QueueSenderService and reflects isGlobal', () => {
      const moduleRef = QueueSenderModule.forRoot({
        adapter: MockSenderAdapter,
        isGlobal: true,
      });

      expect(moduleRef.module).toBe(QueueSenderModule);
      expect(moduleRef.global).toBe(true);
      expect(moduleRef.exports).toContain(QueueSenderService);
      expect(findSenderProvider(moduleRef)).toBeDefined();
    });

    it('defaults global to false', () => {
      const moduleRef = QueueSenderModule.forRoot({
        adapter: MockSenderAdapter,
      });

      expect(moduleRef.global).toBe(false);
    });

    it('builds the adapter and calls setLogger when a logger is provided', () => {
      const moduleRef = QueueSenderModule.forRoot({
        adapter: MockSenderAdapter,
      });

      const instance = findSenderProvider(moduleRef).useFactory(mockLogger);

      expect(instance).toBeInstanceOf(MockSenderAdapter);
      expect((instance as any).logger).toBe(mockLogger);
    });

    it('falls back to NestLoggerAdapter when no logger is provided', () => {
      const moduleRef = QueueSenderModule.forRoot({
        adapter: MockSenderAdapter,
      });

      const instance = findSenderProvider(moduleRef).useFactory(undefined);

      expect((instance as any).logger).toBeInstanceOf(NestLoggerAdapter);
    });

    it('injects an optional LoggerService', () => {
      const moduleRef = QueueSenderModule.forRoot({
        adapter: MockSenderAdapter,
      });

      expect(findSenderProvider(moduleRef).inject).toEqual([
        { token: LoggerService, optional: true },
      ]);
    });
  });

  describe('forRootAsync', () => {
    it('registers and exports QueueSenderService and reflects isGlobal', () => {
      const moduleRef = QueueSenderModule.forRootAsync({
        useFactory: () => new MockSenderAdapter(),
        isGlobal: true,
      });

      expect(moduleRef.global).toBe(true);
      expect(moduleRef.exports).toContain(QueueSenderService);
    });

    it('awaits the factory and calls setLogger when a logger is provided', async () => {
      const moduleRef = QueueSenderModule.forRootAsync({
        useFactory: () => new MockSenderAdapter(),
      });

      const instance =
        await findSenderProvider(moduleRef).useFactory(mockLogger);

      expect(instance).toBeInstanceOf(MockSenderAdapter);
      expect((instance as any).logger).toBe(mockLogger);
    });

    it('falls back to NestLoggerAdapter when no logger is provided', async () => {
      const moduleRef = QueueSenderModule.forRootAsync({
        useFactory: () => new MockSenderAdapter(),
      });

      const instance =
        await findSenderProvider(moduleRef).useFactory(undefined);

      expect((instance as any).logger).toBeInstanceOf(NestLoggerAdapter);
    });

    it('prepends the optional LoggerService to user inject tokens', () => {
      const depToken = 'SOME_DEP';
      const moduleRef = QueueSenderModule.forRootAsync({
        inject: [depToken],
        useFactory: () => new MockSenderAdapter(),
      });

      expect(findSenderProvider(moduleRef).inject).toEqual([
        { token: LoggerService, optional: true },
        depToken,
      ]);
    });

    it('collects imports from options', () => {
      const SomeModule = class {};
      const moduleRef = QueueSenderModule.forRootAsync({
        imports: [SomeModule],
        useFactory: () => new MockSenderAdapter(),
      });

      expect(moduleRef.imports).toContain(SomeModule);
    });
  });
});
