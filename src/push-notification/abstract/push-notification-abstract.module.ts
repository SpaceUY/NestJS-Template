import {
  DynamicModule,
  ForwardReference,
  InjectionToken,
  Module,
  ModuleMetadata,
  Type,
} from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';
import { PushNotificationController } from './push-notification.controller';
import { PUSH_NOTIFICATION_PROVIDER } from './push-notification-provider.const';

type AdapterModule =
  | Type<unknown>
  | DynamicModule
  | Promise<DynamicModule>
  | ForwardReference;

interface PushNotificationModuleOptions {
  adapter: AdapterModule;
  useDefaultController?: boolean;
  isGlobal?: boolean;
  controllers?: Type<unknown>[];
}

// `TArgs` is the tuple of values the `inject` tokens resolve to. It is inferred
// from the factory at the call site, which is what keeps a typed factory —
// `(config: SomeScopeConfig) => ...` — assignable here. A plain `unknown[]`
// would reject it: function parameters are contravariant.
interface PushNotificationModuleAsyncOptions<
  TArgs extends unknown[] = unknown[],
> {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (
    ...args: TArgs
  ) => Promise<PushNotificationService> | PushNotificationService;
  useDefaultController?: boolean;
  isGlobal?: boolean;
  controllers?: Type<unknown>[];
}

/**
 * Builds the controller list without touching the caller's array.
 *
 * @param {Type<unknown>[]} controllers - Controllers supplied by the caller.
 * @param {boolean} useDefaultController - Whether to add the module's own controller.
 * @returns {Type<unknown>[]} A new array; the caller's is never mutated.
 */
function buildControllers(
  controllers: Type<unknown>[],
  useDefaultController: boolean,
): Type<unknown>[] {
  return useDefaultController
    ? [...controllers, PushNotificationController]
    : [...controllers];
}

@Module({})
export class PushNotificationAbstractModule {
  /**
   * Configures the module with an adapter module that provides
   * `PUSH_NOTIFICATION_PROVIDER`.
   *
   * @param {PushNotificationModuleOptions} options - Adapter module, controller and global flags.
   * @returns {DynamicModule} A dynamic module that provides and exports the service.
   */
  static forRoot(options: PushNotificationModuleOptions): DynamicModule {
    const {
      adapter,
      isGlobal = false,
      useDefaultController = true,
      controllers = [],
    } = options;

    return {
      module: PushNotificationAbstractModule,
      global: isGlobal,
      providers: [
        {
          provide: PushNotificationService,
          useFactory: (adapterSvc: PushNotificationService) => adapterSvc,
          inject: [PUSH_NOTIFICATION_PROVIDER],
        },
      ],
      imports: [adapter],
      exports: [PushNotificationService],
      controllers: buildControllers(controllers, useDefaultController),
    };
  }

  /**
   * Configures the module with a service built by a factory, so its
   * configuration can be resolved from DI. With the adapter-module style this
   * module uses, the usual wiring is to import the adapter's own async
   * registration and hand its provider token straight back:
   *
   * ```ts
   * PushNotificationAbstractModule.forRootAsync({
   *   imports: [ExpoAdapterModule.registerAsync({ inject: [expoScope.KEY], useFactory: (c: ExpoScopeConfig) => c })],
   *   inject: [PUSH_NOTIFICATION_PROVIDER],
   *   useFactory: (adapter: PushNotificationService) => adapter,
   * })
   * ```
   *
   * @param {PushNotificationModuleAsyncOptions} options - Factory, its injected dependencies, imports, controller and global flags.
   * @returns {DynamicModule} A dynamic module that provides and exports the service.
   */
  static forRootAsync<TArgs extends unknown[]>(
    options: PushNotificationModuleAsyncOptions<TArgs>,
  ): DynamicModule {
    const {
      isGlobal = false,
      useDefaultController = true,
      controllers = [],
    } = options;

    return {
      module: PushNotificationAbstractModule,
      global: isGlobal,
      imports: options.imports || [],
      providers: [
        {
          provide: PushNotificationService,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [PushNotificationService],
      controllers: buildControllers(controllers, useDefaultController),
    };
  }
}
