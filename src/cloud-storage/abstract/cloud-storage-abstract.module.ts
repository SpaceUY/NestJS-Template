import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from "@nestjs/common";
import { ClassConstructor } from "class-transformer";
import { CloudStorageController } from "./cloud-storage.controller";
import { CloudStorageService } from "./cloud-storage.service";

interface CloudStorageModuleOptions {
  adapter: ClassConstructor<CloudStorageService>;
  isGlobal?: boolean;
  useDefaultController?: boolean;
}

interface CloudStorageModuleAsyncOptions {
  imports?: ModuleMetadata["imports"];
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
    const {
      adapter,
      isGlobal = false,
      useDefaultController = false,
    } = options;

    return {
      module: CloudStorageAbstractModule,
      global: isGlobal,
      providers: [
        {
          provide: CloudStorageService,
          useClass: adapter,
        },
      ],
      exports: [CloudStorageService],
      controllers: useDefaultController ? [CloudStorageController] : [],
    };
  }

  static forRootAsync(options: CloudStorageModuleAsyncOptions): DynamicModule {
    const {
      isGlobal = false,
      useDefaultController = false,
    } = options;

    return {
      module: CloudStorageAbstractModule,
      global: isGlobal,
      imports: options.imports || [],
      providers: [
        {
          provide: CloudStorageService,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [CloudStorageService],
      controllers: useDefaultController ? [CloudStorageController] : [],
    };
  }
}
