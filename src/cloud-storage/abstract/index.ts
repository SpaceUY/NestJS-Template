import { Module, Type } from '@nestjs/common';

interface IAbstractCloudStorageModuleOptions {
  adapter: Type<CloudStorageService>;
}

@Module({})
export class AbstractModule {
  static forRoot(options: IAbstractCloudStorageModuleOptions) {
    const { adapter } = options;
    return {
      module: AbstractModule,
      imports: [],
      providers: [{ provide: CloudStorageService, useClass: adapter }],
      exports: [],
      controllers: [CloudStorageController],
    };
  }
}
