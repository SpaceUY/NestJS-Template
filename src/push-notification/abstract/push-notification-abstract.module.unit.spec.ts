import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PushNotificationAbstractModule } from './push-notification-abstract.module';
import { PushNotificationController } from './push-notification.controller';
import { PushNotificationService } from './push-notification.service';
import { PUSH_NOTIFICATION_PROVIDER } from './push-notification-provider.const';
import { MockPushNotificationService } from './mocks/push-notification.service.mock';

@Module({
  providers: [
    {
      provide: PUSH_NOTIFICATION_PROVIDER,
      useClass: MockPushNotificationService,
    },
  ],
  exports: [PUSH_NOTIFICATION_PROVIDER],
})
class MockAdapterModule {}

type ProviderShape = {
  provide: unknown;
  inject: unknown[];
  useFactory: (...args: unknown[]) => unknown;
};

const serviceProvider = (moduleRef: {
  providers?: unknown[];
}): ProviderShape | undefined =>
  (moduleRef.providers as ProviderShape[]).find(
    (p) => p.provide === PushNotificationService,
  );

describe('PushNotificationAbstractModule', () => {
  describe('forRoot', () => {
    it('imports the adapter module and re-exposes its provider under the service token', () => {
      const moduleRef = PushNotificationAbstractModule.forRoot({
        adapter: MockAdapterModule,
        isGlobal: true,
      });

      expect(moduleRef.module).toBe(PushNotificationAbstractModule);
      expect(moduleRef.global).toBe(true);
      expect(moduleRef.imports).toEqual([MockAdapterModule]);
      expect(moduleRef.exports).toContain(PushNotificationService);
      expect(serviceProvider(moduleRef)?.inject).toEqual([
        PUSH_NOTIFICATION_PROVIDER,
      ]);
    });

    it('adds the default controller unless it is turned off', () => {
      const withDefault = PushNotificationAbstractModule.forRoot({
        adapter: MockAdapterModule,
      });
      const without = PushNotificationAbstractModule.forRoot({
        adapter: MockAdapterModule,
        useDefaultController: false,
      });

      expect(withDefault.controllers).toEqual([PushNotificationController]);
      expect(without.controllers).toEqual([]);
    });

    it('does not mutate the controllers array it is given', () => {
      const controllers: never[] = [];

      const moduleRef = PushNotificationAbstractModule.forRoot({
        adapter: MockAdapterModule,
        controllers,
      });

      expect(controllers).toEqual([]);
      expect(moduleRef.controllers).toEqual([PushNotificationController]);
    });

    it('keeps the caller controllers and appends the default one', () => {
      class CustomController {}

      const moduleRef = PushNotificationAbstractModule.forRoot({
        adapter: MockAdapterModule,
        controllers: [CustomController],
      });

      expect(moduleRef.controllers).toEqual([
        CustomController,
        PushNotificationController,
      ]);
    });
  });

  describe('forRootAsync', () => {
    it('provides the service from the caller factory and its injected tokens', async () => {
      const seen: unknown[] = [];

      const moduleRef = PushNotificationAbstractModule.forRootAsync({
        inject: ['TOKEN_A'],
        useFactory: (a: unknown) => {
          seen.push(a);
          return new MockPushNotificationService();
        },
      });

      const provider = serviceProvider(moduleRef);

      expect(provider?.inject).toEqual(['TOKEN_A']);
      expect(await provider?.useFactory('value-a')).toBeInstanceOf(
        MockPushNotificationService,
      );
      expect(seen).toEqual(['value-a']);
    });

    it('carries the caller imports through untouched', () => {
      const moduleRef = PushNotificationAbstractModule.forRootAsync({
        imports: [MockAdapterModule],
        useFactory: () => new MockPushNotificationService(),
      });

      expect(moduleRef.imports).toEqual([MockAdapterModule]);
    });

    it('does not mutate the controllers array it is given', () => {
      const controllers: never[] = [];

      const moduleRef = PushNotificationAbstractModule.forRootAsync({
        controllers,
        useFactory: () => new MockPushNotificationService(),
      });

      expect(controllers).toEqual([]);
      expect(moduleRef.controllers).toEqual([PushNotificationController]);
    });
  });

  // The blocks above call useFactory by hand, which cannot prove the container
  // resolves the provider token. These boot a real container.
  describe('resolved through a real Nest container', () => {
    it('forRoot resolves the adapter module provider under the service token', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          PushNotificationAbstractModule.forRoot({
            adapter: MockAdapterModule,
            useDefaultController: false,
          }),
        ],
      }).compile();

      expect(moduleRef.get(PushNotificationService)).toBeInstanceOf(
        MockPushNotificationService,
      );

      await moduleRef.close();
    });

    it('forRootAsync composes with the adapter module through its provider token', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          PushNotificationAbstractModule.forRootAsync({
            imports: [MockAdapterModule],
            inject: [PUSH_NOTIFICATION_PROVIDER],
            useFactory: (adapter: PushNotificationService) => adapter,
            useDefaultController: false,
          }),
        ],
      }).compile();

      expect(moduleRef.get(PushNotificationService)).toBeInstanceOf(
        MockPushNotificationService,
      );

      await moduleRef.close();
    });
  });
});
