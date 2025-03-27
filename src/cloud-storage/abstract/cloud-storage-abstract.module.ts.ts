import { DynamicModule, Module, Type } from '@nestjs/common';
import { CloudStorageService } from './cloud-storage.service';
import { CloudStorageController } from './cloud-storage.controller';

interface IAbstractCloudStorageModuleOptions {
  adapter: Type<CloudStorageService>;
}

@Module({})
export class CloudStorageAbstractModule {
  static forRoot(options: IAbstractCloudStorageModuleOptions): DynamicModule {
    const { adapter } = options;
    return {
      module: CloudStorageAbstractModule,
      imports: [],
      providers: [{ provide: CloudStorageService, useClass: adapter }],
      exports: [],
      controllers: [CloudStorageController],
    };
  }
}
