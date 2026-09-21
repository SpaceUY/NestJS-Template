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
  | Type<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  | DynamicModule
  | Promise<DynamicModule>
  | ForwardReference;

interface PushNotificationModuleOptions {
  adapter: AdapterModule;
  useDefaultController?: boolean;
  isGlobal?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controllers?: Type<any>[];
}

interface PushNotificationModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  // `any[]` mirrors NestJS's own *ModuleAsyncOptions: the factory's args are the
  // resolved `inject` tokens, whose types this interface can't know.
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => Promise<PushNotificationService> | PushNotificationService;
  useDefaultController?: boolean;
  isGlobal?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controllers?: Type<any>[];
}

/**
 * Builds the controller list without touching the caller's array.
 *
 * @param {Type<any>[]} controllers - Controllers supplied by the caller.
 * @param {boolean} useDefaultController - Whether to add the module's own controller.
 * @returns {Type<any>[]} A new array; the caller's is never mutated.
 */
function buildControllers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controllers: Type<any>[],
  useDefaultController: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Type<any>[] {
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
  static forRootAsync(
    options: PushNotificationModuleAsyncOptions,
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
