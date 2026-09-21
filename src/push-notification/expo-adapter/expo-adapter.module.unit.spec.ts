import { DynamicModule } from '@nestjs/common';
import { ExpoAdapterModule } from './expo-adapter.module';
import { ExpoAdapterService } from './expo-adapter.service';
import { ExpoAdapterConfig } from './expo-adapter-config.interface';
import { EXPO_ADAPTER_PROVIDER_CONFIG } from './expo-adapter-config-provider.const';
import { PUSH_NOTIFICATION_PROVIDER } from '../abstract/push-notification-provider.const';

type ProviderShape = {
  provide: unknown;
  useClass?: unknown;
  useValue?: unknown;
  inject?: unknown[];
  useFactory?: (...args: unknown[]) => unknown;
};

const shapes = (moduleRef: DynamicModule): ProviderShape[] =>
  (moduleRef.providers ?? []) as ProviderShape[];

const providerFor = (
  moduleRef: DynamicModule,
  token: unknown,
): ProviderShape | undefined =>
  shapes(moduleRef).find((p) => p.provide === token);

const config: ExpoAdapterConfig = { expoAccessToken: 'an-expo-token' };

describe('ExpoAdapterModule', () => {
  describe('register', () => {
    it('binds the adapter under the provider token the abstract module reads', () => {
      const moduleRef = ExpoAdapterModule.register(config);

      expect(moduleRef.module).toBe(ExpoAdapterModule);
      expect(providerFor(moduleRef, PUSH_NOTIFICATION_PROVIDER)?.useClass).toBe(
        ExpoAdapterService,
      );
      expect(moduleRef.exports).toEqual([PUSH_NOTIFICATION_PROVIDER]);
    });

    it('hands the config object to the adapter untouched', () => {
      const moduleRef = ExpoAdapterModule.register(config);

      expect(
        providerFor(moduleRef, EXPO_ADAPTER_PROVIDER_CONFIG)?.useValue,
      ).toBe(config);
    });

    // The config provider holds an Expo access token. Exporting it would put
    // a credential on the public surface of the module (`T4`).
    it('keeps the config token internal to the module', () => {
      expect(ExpoAdapterModule.register(config).exports).not.toContain(
        EXPO_ADAPTER_PROVIDER_CONFIG,
      );
    });
  });

  describe('registerAsync', () => {
    it('builds the config from the caller factory and its injected tokens', async () => {
      const seen: unknown[] = [];

      const moduleRef = ExpoAdapterModule.registerAsync({
        inject: ['EXPO_SCOPE'],
        useFactory: (scope: { accessToken: string }) => {
          seen.push(scope);
          return { expoAccessToken: scope.accessToken };
        },
      });

      const provider = providerFor(moduleRef, EXPO_ADAPTER_PROVIDER_CONFIG);

      expect(provider?.inject).toEqual(['EXPO_SCOPE']);
      expect(
        await provider?.useFactory?.({ accessToken: 'an-expo-token' }),
      ).toEqual(config);
      expect(seen).toEqual([{ accessToken: 'an-expo-token' }]);
    });

    it('still binds the adapter under the provider token', () => {
      const moduleRef = ExpoAdapterModule.registerAsync({
        useFactory: () => config,
      });

      expect(providerFor(moduleRef, PUSH_NOTIFICATION_PROVIDER)?.useClass).toBe(
        ExpoAdapterService,
      );
      expect(moduleRef.exports).toEqual([PUSH_NOTIFICATION_PROVIDER]);
    });

    it('defaults imports and inject to empty arrays when omitted', () => {
      const moduleRef = ExpoAdapterModule.registerAsync({
        useFactory: () => config,
      });

      expect(moduleRef.imports).toEqual([]);
      expect(
        providerFor(moduleRef, EXPO_ADAPTER_PROVIDER_CONFIG)?.inject,
      ).toEqual([]);
    });

    it('carries the caller imports through untouched', () => {
      class SomeConfigModule {}

      expect(
        ExpoAdapterModule.registerAsync({
          imports: [SomeConfigModule],
          useFactory: () => config,
        }).imports,
      ).toEqual([SomeConfigModule]);
    });

    it('awaits an async factory', async () => {
      const moduleRef = ExpoAdapterModule.registerAsync({
        useFactory: async () => {
          await Promise.resolve();
          return config;
        },
      });

      expect(
        await providerFor(
          moduleRef,
          EXPO_ADAPTER_PROVIDER_CONFIG,
        )?.useFactory?.(),
      ).toBe(config);
    });
  });
});
