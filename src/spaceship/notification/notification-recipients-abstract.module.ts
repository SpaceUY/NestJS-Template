import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { NotificationRecipientsProvider } from './notification-recipients.provider';

interface NotificationRecipientsModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => Promise<NotificationRecipientsProvider> | NotificationRecipientsProvider;
}

@Module({})
export class NotificationRecipientsAbstractModule {
  static forRootAsync(
    options: NotificationRecipientsModuleAsyncOptions,
  ): DynamicModule {
    return {
      module: NotificationRecipientsAbstractModule,
      imports: options.imports || [],
      providers: [
        {
          provide: NotificationRecipientsProvider,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [NotificationRecipientsProvider],
    };
  }
}
