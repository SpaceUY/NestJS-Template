import { DynamicModule, Module, Type } from '@nestjs/common';
import { CloudStorageService } from './cloud-storage.service';
import { CloudStorageController } from './cloud-storage.controller';
import { ICloudStorageProvider } from './cloud-storage-provider.interface';
import { CLOUD_STORAGE_PROVIDER } from './cloud-storage-provider.const';

interface IAbstractCloudStorageModuleOptions {
  adapter: Type<ICloudStorageProvider>;
}

@Module({})
export class CloudStorageAbstractModule {
  static forRoot(options: IAbstractCloudStorageModuleOptions): DynamicModule {
    const { adapter } = options;
    return {
      module: CloudStorageAbstractModule,
      imports: [],
      providers: [
        CloudStorageService,
        { provide: CLOUD_STORAGE_PROVIDER, useClass: adapter },
      ],
      exports: [CloudStorageService],
      controllers: [CloudStorageController],
    };
  }
}
