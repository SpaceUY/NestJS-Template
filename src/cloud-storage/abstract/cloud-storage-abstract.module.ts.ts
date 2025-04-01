import { DynamicModule, ForwardReference, Module, Type } from '@nestjs/common';
import { CloudStorageService } from './cloud-storage.service';
import { CloudStorageController } from './cloud-storage.controller';
import { CLOUD_STORAGE_PROVIDER } from './cloud-storage-provider.const';

type AdapterModule =
  | Type<any>
  | DynamicModule
  | Promise<DynamicModule>
  | ForwardReference;

interface CloudStorageModuleOptions {
  adapter: AdapterModule;
  useDefaultController?: boolean;
  isGlobal?: boolean;
}

@Module({})
export class CloudStorageAbstractModule {
  static forRoot(options: CloudStorageModuleOptions): DynamicModule {
    const { adapter, isGlobal = false } = options;

    const controllers = options.useDefaultController
      ? [CloudStorageController]
      : [];

    return {
      module: CloudStorageAbstractModule,
      global: isGlobal,
      providers: [
        {
          provide: CloudStorageService,
          useFactory: (adapter) => adapter,
          inject: [CLOUD_STORAGE_PROVIDER],
        },
      ],
      imports: [adapter],
      exports: [CloudStorageService],
      controllers,
    };
  }
}
