import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { ClassConstructor } from 'class-transformer';
import { CloudStorageController } from './cloud-storage.controller';
import { CloudStorageService } from './cloud-storage.service';
import { LoggerService } from '../../common/logger/abstract/logger.service';

interface CloudStorageModuleOptions {
  adapter: ClassConstructor<CloudStorageService>;
  isGlobal?: boolean;
  useDefaultController?: boolean;
}

interface CloudStorageModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (
    ...args: any[]
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

  static forRootAsync(options: CloudStorageModuleAsyncOptions): DynamicModule {
    const { isGlobal = false, useDefaultController = false } = options;

    return {
      module: CloudStorageAbstractModule,
      global: isGlobal,
      imports: options.imports || [],
      providers: [
        {
          provide: CloudStorageService,
          useFactory: async (logger: LoggerService | undefined, ...args: unknown[]) => {
            const instance = await options.useFactory(...args);
            if (logger) instance.setLogger(logger);
            return instance;
          },
          inject: [{ token: LoggerService, optional: true }, ...(options.inject || [])],
        },
      ],
      exports: [CloudStorageService],
      controllers: useDefaultController ? [CloudStorageController] : [],
    };
  }
}
