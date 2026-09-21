import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { CloudStorageController } from './cloud-storage.controller';
import { CloudStorageService } from './cloud-storage.service';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';

interface CloudStorageModuleOptions {
  // forRoot instantiates the adapter directly (no NestJS DI) so the module can
  // hand it the container's logger. Adapters that need constructor arguments
  // must use forRootAsync instead.
  adapter: new () => CloudStorageService;
  isGlobal?: boolean;
  useDefaultController?: boolean;
}

// `TArgs` is the tuple of values the `inject` tokens resolve to. It is inferred
// from the factory at the call site, which is what keeps a typed factory —
// `(config: SomeScopeConfig) => ...` — assignable here. A plain `unknown[]`
// would reject it: function parameters are contravariant.
interface CloudStorageModuleAsyncOptions<TArgs extends unknown[] = unknown[]> {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (
    ...args: TArgs
  ) => Promise<CloudStorageService> | CloudStorageService;
  isGlobal?: boolean;
  useDefaultController?: boolean;
}

@Module({})
export class CloudStorageAbstractModule {
  static forRoot(options: CloudStorageModuleOptions): DynamicModule {
    const { adapter, isGlobal = false, useDefaultController = false } = options;

    return {
      module: CloudStorageAbstractModule,
      global: isGlobal,
      providers: [
        {
          provide: CloudStorageService,
          useFactory: (logger?: LoggerService) => {
            const instance = new adapter();
            if (logger) instance.setLogger(logger);
            return instance;
          },
          inject: [{ token: LoggerService, optional: true }],
        },
      ],
      exports: [CloudStorageService],
      controllers: useDefaultController ? [CloudStorageController] : [],
    };
  }

  static forRootAsync<TArgs extends unknown[]>(
    options: CloudStorageModuleAsyncOptions<TArgs>,
  ): DynamicModule {
    const { isGlobal = false, useDefaultController = false } = options;

    return {
      module: CloudStorageAbstractModule,
      global: isGlobal,
      imports: options.imports || [],
      providers: [
        {
          provide: CloudStorageService,
          useFactory: async (
            logger: LoggerService | undefined,
            ...args: TArgs
          ) => {
            const instance = await options.useFactory(...args);
            if (logger) instance.setLogger(logger);
            return instance;
          },
          inject: [
            { token: LoggerService, optional: true },
            ...(options.inject || []),
          ],
        },
      ],
      exports: [CloudStorageService],
      controllers: useDefaultController ? [CloudStorageController] : [],
    };
  }
}
