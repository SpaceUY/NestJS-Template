import { Module } from '@nestjs/common';
import { NotificationRecipientsAbstractModule } from './notification-recipients-abstract.module';
import { NotificationRecipientsProvider } from './notification-recipients.provider';

@Module({})
class DummyImportModule {}

describe('NotificationRecipientsAbstractModule', () => {
  it('should default imports to an empty array when none are passed', () => {
    const moduleRef = NotificationRecipientsAbstractModule.forRootAsync({
      useFactory: () => ({ getRecipients: async () => [] }),
    });

    expect(moduleRef.imports).toEqual([]);
  });

  it('should bind a factory-returned instance to NotificationRecipientsProvider in forRootAsync', async () => {
    const dependencyToken = 'TEST_DEPENDENCY';
    const dependencyValue = 'dependency-value';
    const recipientsInstance: NotificationRecipientsProvider = {
      getRecipients: async () => ['a@example.com'],
    };

    const moduleRef = NotificationRecipientsAbstractModule.forRootAsync({
      imports: [DummyImportModule],
      inject: [dependencyToken],
      useFactory: async (value: string) => {
        expect(value).toBe(dependencyValue);
        return recipientsInstance;
      },
    });

    const provider = (
      moduleRef.providers as Array<{
        provide: unknown;
        inject: unknown[];
        useFactory: (
          ...args: unknown[]
        ) =>
          | Promise<NotificationRecipientsProvider>
          | NotificationRecipientsProvider;
      }>
    ).find((p) => p.provide === NotificationRecipientsProvider);

    const resolved = await provider?.useFactory(dependencyValue);

    expect(moduleRef.module).toBe(NotificationRecipientsAbstractModule);
    expect(moduleRef.imports).toEqual([DummyImportModule]);
    expect(provider?.provide).toBe(NotificationRecipientsProvider);
    expect(provider?.inject).toEqual([dependencyToken]);
    expect(resolved).toBe(recipientsInstance);
    expect(moduleRef.exports).toContain(NotificationRecipientsProvider);
    expect(moduleRef.global).toBeUndefined();
  });
});
