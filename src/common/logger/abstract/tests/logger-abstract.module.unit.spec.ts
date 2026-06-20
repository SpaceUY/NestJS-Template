import { LoggerAbstractModule } from '../logger-abstract.module';
import { LoggerService } from '../logger.service';

class MockAdapter extends LoggerService {
  setContext = jest.fn();
  log = jest.fn();
  warn = jest.fn();
  error = jest.fn();
  debug = jest.fn();
}

describe('LoggerAbstractModule', () => {
  describe('forRoot', () => {
    it('should bind the adapter class to LoggerService', () => {
      const moduleRef = LoggerAbstractModule.forRoot({ adapter: MockAdapter });

      const provider = (
        moduleRef.providers as Array<{
          provide: unknown;
          useFactory: () => LoggerService;
        }>
      ).find((p) => p.provide === LoggerService);

      expect(moduleRef.module).toBe(LoggerAbstractModule);
      expect(moduleRef.global).toBe(false);
      expect(provider?.useFactory()).toBeInstanceOf(MockAdapter);
      expect(moduleRef.exports).toContain(LoggerService);
    });

    it('should set isGlobal when specified', () => {
      const moduleRef = LoggerAbstractModule.forRoot({
        adapter: MockAdapter,
        isGlobal: true,
      });

      expect(moduleRef.global).toBe(true);
    });

    it('should wire the telemetryHook on the created instance', () => {
      const hook = jest.fn();
      const moduleRef = LoggerAbstractModule.forRoot({
        adapter: MockAdapter,
        telemetryHook: hook,
      });

      const provider = (
        moduleRef.providers as Array<{
          provide: unknown;
          useFactory: () => LoggerService;
        }>
      ).find((p) => p.provide === LoggerService);

      const instance = provider!.useFactory();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((instance as any).telemetryHook).toBe(hook);
    });

    it('should not set telemetryHook when none is provided', () => {
      const moduleRef = LoggerAbstractModule.forRoot({ adapter: MockAdapter });

      const provider = (
        moduleRef.providers as Array<{
          provide: unknown;
          useFactory: () => LoggerService;
        }>
      ).find((p) => p.provide === LoggerService);

      const instance = provider!.useFactory();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((instance as any).telemetryHook).toBeUndefined();
    });
  });

  describe('forRootAsync', () => {
    it('should resolve the factory-returned instance as LoggerService', async () => {
      const adapterInstance = new MockAdapter();
      const token = 'SOME_TOKEN';
      const tokenValue = 'some-value';

      const moduleRef = LoggerAbstractModule.forRootAsync({
        inject: [token],
        useFactory: (val: string) => {
          expect(val).toBe(tokenValue);
          return adapterInstance;
        },
        isGlobal: true,
      });

      const provider = (
        moduleRef.providers as Array<{
          provide: unknown;
          inject: unknown[];
          useFactory: (
            ...args: unknown[]
          ) => Promise<LoggerService> | LoggerService;
        }>
      ).find((p) => p.provide === LoggerService);

      const resolved = await provider!.useFactory(tokenValue);

      expect(moduleRef.global).toBe(true);
      expect(provider!.inject).toEqual([token]);
      expect(resolved).toBe(adapterInstance);
      expect(moduleRef.exports).toContain(LoggerService);
    });

    it('should wire the telemetryHook on the async-resolved instance', async () => {
      const hook = jest.fn();
      const adapterInstance = new MockAdapter();

      const moduleRef = LoggerAbstractModule.forRootAsync({
        useFactory: () => adapterInstance,
        telemetryHook: hook,
      });

      const provider = (
        moduleRef.providers as Array<{
          provide: unknown;
          inject: unknown[];
          useFactory: () => Promise<LoggerService> | LoggerService;
        }>
      ).find((p) => p.provide === LoggerService);

      const resolved = await provider!.useFactory();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((resolved as any).telemetryHook).toBe(hook);
    });

    it('should default imports and inject to empty arrays when omitted', () => {
      const moduleRef = LoggerAbstractModule.forRootAsync({
        useFactory: () => new MockAdapter(),
      });

      expect(moduleRef.imports).toEqual([]);

      const provider = (
        moduleRef.providers as Array<{ provide: unknown; inject: unknown[] }>
      ).find((p) => p.provide === LoggerService);

      expect(provider!.inject).toEqual([]);
    });
  });
});
