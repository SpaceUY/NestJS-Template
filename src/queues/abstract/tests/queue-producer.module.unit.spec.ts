import { QueueProducerModule } from '../producer/queue-producer.module';
import { QueueProducerService } from '../producer/queue-producer.service';
import { LoggerService } from '../../../common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../../common/observability/logger/nest-adapter/nest-logger.adapter';

class MockProducerAdapter extends QueueProducerService {
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

/** A provider entry as these tests read it back off a DynamicModule. */
type ProviderEntry = {
  provide?: unknown;
  inject?: unknown[];
  useFactory: (...args: unknown[]) => unknown;
};

/** Reads the private `logger` the module hands the adapter. */
const loggerOf = (instance: unknown): unknown =>
  (instance as { logger?: unknown }).logger;

function findProducerProvider(moduleRef: {
  providers?: unknown[];
}): ProviderEntry {
  return ((moduleRef.providers ?? []) as ProviderEntry[]).find(
    (p) => p.provide === QueueProducerService,
  ) as ProviderEntry;
}

describe('QueueProducerModule', () => {
  describe('forRoot', () => {
    it('registers and exports QueueProducerService and reflects isGlobal', () => {
      const moduleRef = QueueProducerModule.forRoot({
        adapter: MockProducerAdapter,
        isGlobal: true,
      });

      expect(moduleRef.module).toBe(QueueProducerModule);
      expect(moduleRef.global).toBe(true);
      expect(moduleRef.exports).toContain(QueueProducerService);
      expect(findProducerProvider(moduleRef)).toBeDefined();
    });

    it('defaults global to false', () => {
      const moduleRef = QueueProducerModule.forRoot({
        adapter: MockProducerAdapter,
      });

      expect(moduleRef.global).toBe(false);
    });

    it('builds the adapter and calls setLogger when a logger is provided', () => {
      const moduleRef = QueueProducerModule.forRoot({
        adapter: MockProducerAdapter,
      });

      const instance = findProducerProvider(moduleRef).useFactory(mockLogger);

      expect(instance).toBeInstanceOf(MockProducerAdapter);
      expect(loggerOf(instance)).toBe(mockLogger);
    });

    it('falls back to NestLoggerAdapter when no logger is provided', () => {
      const moduleRef = QueueProducerModule.forRoot({
        adapter: MockProducerAdapter,
      });

      const instance = findProducerProvider(moduleRef).useFactory(undefined);

      expect(loggerOf(instance)).toBeInstanceOf(NestLoggerAdapter);
    });

    it('injects an optional LoggerService', () => {
      const moduleRef = QueueProducerModule.forRoot({
        adapter: MockProducerAdapter,
      });

      expect(findProducerProvider(moduleRef).inject).toEqual([
        { token: LoggerService, optional: true },
      ]);
    });
  });

  describe('forRootAsync', () => {
    it('registers and exports QueueProducerService and reflects isGlobal', () => {
      const moduleRef = QueueProducerModule.forRootAsync({
        useFactory: () => new MockProducerAdapter(),
        isGlobal: true,
      });

      expect(moduleRef.global).toBe(true);
      expect(moduleRef.exports).toContain(QueueProducerService);
    });

    it('awaits the factory and calls setLogger when a logger is provided', async () => {
      const moduleRef = QueueProducerModule.forRootAsync({
        useFactory: () => new MockProducerAdapter(),
      });

      const instance =
        await findProducerProvider(moduleRef).useFactory(mockLogger);

      expect(instance).toBeInstanceOf(MockProducerAdapter);
      expect(loggerOf(instance)).toBe(mockLogger);
    });

    it('falls back to NestLoggerAdapter when no logger is provided', async () => {
      const moduleRef = QueueProducerModule.forRootAsync({
        useFactory: () => new MockProducerAdapter(),
      });

      const instance =
        await findProducerProvider(moduleRef).useFactory(undefined);

      expect(loggerOf(instance)).toBeInstanceOf(NestLoggerAdapter);
    });

    it('prepends the optional LoggerService to user inject tokens', () => {
      const depToken = 'SOME_DEP';
      const moduleRef = QueueProducerModule.forRootAsync({
        inject: [depToken],
        useFactory: () => new MockProducerAdapter(),
      });

      expect(findProducerProvider(moduleRef).inject).toEqual([
        { token: LoggerService, optional: true },
        depToken,
      ]);
    });

    it('collects imports from options', () => {
      const SomeModule = class {};
      const moduleRef = QueueProducerModule.forRootAsync({
        imports: [SomeModule],
        useFactory: () => new MockProducerAdapter(),
      });

      expect(moduleRef.imports).toContain(SomeModule);
    });
  });
});
