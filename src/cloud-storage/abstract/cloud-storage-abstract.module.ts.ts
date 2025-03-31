import { DynamicModule, Module, Type } from '@nestjs/common';
import { CloudStorageService } from './cloud-storage.service';
import { CloudStorageController } from './cloud-storage.controller';
import { CLOUD_STORAGE_PROVIDER } from './cloud-storage-provider.const';

@Module({})
export class CloudStorageAbstractModule {
  static forRoot(options: { adapter: DynamicModule }): DynamicModule {
    const { adapter } = options;
    return {
      module: CloudStorageAbstractModule,
      providers: [
        {
          provide: CloudStorageService,
          useFactory: (adapter) => adapter,
          inject: [CLOUD_STORAGE_PROVIDER],
        },
      ],
      imports: [adapter],
      exports: [CloudStorageService],
      controllers: [CloudStorageController],
    };
  }
}
