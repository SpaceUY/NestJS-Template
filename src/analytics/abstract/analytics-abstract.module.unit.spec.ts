import { AnalyticsAbstractModule } from './analytics-abstract.module';
import { AnalyticsService } from './analytics.service';

class MockAdapter extends AnalyticsService {
  capture = jest.fn();
  isFeatureEnabled = jest.fn(async () => false);
  getFeatureFlag = jest.fn(async () => undefined);
}

describe('AnalyticsAbstractModule', () => {
  describe('forRoot', () => {
    it('should bind the adapter class to AnalyticsService', () => {
      const moduleRef = AnalyticsAbstractModule.forRoot({
        adapter: MockAdapter,
      });

      const provider = (
        moduleRef.providers as Array<{
          provide: unknown;
          useClass: unknown;
        }>
      ).find((p) => p.provide === AnalyticsService);

      expect(moduleRef.module).toBe(AnalyticsAbstractModule);
      expect(moduleRef.global).toBe(false);
      expect(provider?.useClass).toBe(MockAdapter);
      expect(moduleRef.exports).toContain(AnalyticsService);
    });

    it('should set isGlobal when specified', () => {
      const moduleRef = AnalyticsAbstractModule.forRoot({
        adapter: MockAdapter,
        isGlobal: true,
      });

      expect(moduleRef.global).toBe(true);
    });
  });

  describe('forRootAsync', () => {
    it('should resolve the factory-returned instance as AnalyticsService', async () => {
      const adapterInstance = new MockAdapter();
      const token = 'SOME_TOKEN';
      const tokenValue = 'some-value';

      const moduleRef = AnalyticsAbstractModule.forRootAsync({
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
          ) => Promise<AnalyticsService> | AnalyticsService;
        }>
      ).find((p) => p.provide === AnalyticsService);

      const resolved = await provider!.useFactory(tokenValue);

      expect(moduleRef.global).toBe(true);
      expect(provider!.inject).toEqual([token]);
      expect(resolved).toBe(adapterInstance);
      expect(moduleRef.exports).toContain(AnalyticsService);
    });

    it('should default imports and inject to empty arrays when omitted', () => {
      const moduleRef = AnalyticsAbstractModule.forRootAsync({
        useFactory: () => new MockAdapter(),
      });

      expect(moduleRef.imports).toEqual([]);

      const provider = (
        moduleRef.providers as Array<{ provide: unknown; inject: unknown[] }>
      ).find((p) => p.provide === AnalyticsService);

      expect(provider!.inject).toEqual([]);
    });
  });
});
