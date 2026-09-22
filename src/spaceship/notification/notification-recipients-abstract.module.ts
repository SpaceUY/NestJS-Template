import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { NotificationRecipientsProvider } from './notification-recipients.provider';

// `TArgs` is the tuple of values the `inject` tokens resolve to. It is inferred
// from the factory at the call site, which is what keeps a typed factory —
// `(config: NotificationRecipientsScopeConfig) => ...` — assignable here. A
// plain `unknown[]` would reject it: function parameters are contravariant.
// See invariant `T6`: this is the template-wide alternative to `any[]`, which
// is what NestJS's own `*ModuleAsyncOptions` use here.
interface NotificationRecipientsModuleAsyncOptions<
  TArgs extends unknown[] = unknown[],
> {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (
    ...args: TArgs
  ) => Promise<NotificationRecipientsProvider> | NotificationRecipientsProvider;
}

@Module({})
export class NotificationRecipientsAbstractModule {
  /**
   * Binds a recipients provider built from DI.
   *
   * @param {NotificationRecipientsModuleAsyncOptions<TArgs>} options - Imports, inject tokens and the factory that builds the provider.
   * @returns {DynamicModule} A module exporting `NotificationRecipientsProvider`.
   */
  static forRootAsync<TArgs extends unknown[]>(
    options: NotificationRecipientsModuleAsyncOptions<TArgs>,
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
