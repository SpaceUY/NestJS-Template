import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { S3AdapterService } from './s3-adapter.service';
import { S3AdapterConfig } from './s3-adapter-config.interface';
import { S3_ADAPTER_PROVIDER_CONFIG } from './s3-adapter-config-provider.const';
import { CLOUD_STORAGE_PROVIDER } from '../abstract/cloud-storage-provider.const';

@Module({})
export class S3AdapterModule {
  static register(config: S3AdapterConfig): DynamicModule {
    return {
      module: S3AdapterModule,
      providers: [
        {
          provide: S3_ADAPTER_PROVIDER_CONFIG,
          useValue: config,
        },
        { provide: CLOUD_STORAGE_PROVIDER, useClass: S3AdapterService },
      ],
      exports: [CLOUD_STORAGE_PROVIDER],
    };
  }

  static registerAsync(options: {
    imports?: ModuleMetadata['imports'];
    inject?: InjectionToken[];
    useFactory: (...args: any[]) => Promise<S3AdapterConfig> | S3AdapterConfig;
  }): DynamicModule {
    return {
      module: S3AdapterModule,
      imports: options.imports || [],
      providers: [
        {
          provide: S3_ADAPTER_PROVIDER_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        { provide: CLOUD_STORAGE_PROVIDER, useClass: S3AdapterService },
      ],
      exports: [CLOUD_STORAGE_PROVIDER],
    };
  }
}
