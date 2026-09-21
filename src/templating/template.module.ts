import {
  DynamicModule,
  ForwardReference,
  InjectionToken,
  Module,
  ModuleMetadata,
  Type,
} from '@nestjs/common';
import { TEMPLATE_PROVIDER } from './abstract/template-provider.const';
import { TemplateService } from './abstract/template.service';
import { validateAdapterModule } from '../common/utils/nest-module-validation';

type AdapterModuleLike =
  | Type<unknown>
  | DynamicModule
  | Promise<DynamicModule>
  | ForwardReference;

interface TemplateModuleOptions {
  adapter: AdapterModuleLike;
  isGlobal?: boolean;
}

interface TemplateModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  // `any[]` mirrors NestJS's own *ModuleAsyncOptions: the factory's args are the
  // resolved `inject` tokens, whose types this interface can't know.
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => Promise<TemplateService> | TemplateService;
  isGlobal?: boolean;
}

@Module({})
export class TemplateModule {
  /**
   * Configures the module with an adapter module that provides
   * `TEMPLATE_PROVIDER`.
   *
   * @param {TemplateModuleOptions} options - Adapter module and global flag.
   * @returns {DynamicModule} A dynamic module that provides and exports the service.
   */
  static forRoot(options: TemplateModuleOptions): DynamicModule {
    const { adapter, isGlobal = false } = options;
    validateAdapterModule(adapter, 'TemplateModule.forRoot');
    return {
      module: TemplateModule,
      global: isGlobal,
      providers: [
        {
          provide: TemplateService,
          useFactory: (adapterSvc: TemplateService) => adapterSvc,
          inject: [TEMPLATE_PROVIDER],
        },
      ],
      imports: [adapter],
      exports: [TemplateService],
    };
  }

  /**
   * Configures the module with a service built by a factory, so its
   * configuration can be resolved from DI. With the adapter-module style this
   * module uses, the usual wiring is to import the adapter's own async
   * registration and hand its provider token straight back:
   *
   * ```ts
   * TemplateModule.forRootAsync({
   *   imports: [PugAdapterModule.registerAsync({ inject: [appScope.KEY], useFactory: (c: AppScopeConfig) => ({ baseDir: c.templatesDir }) })],
   *   inject: [TEMPLATE_PROVIDER],
   *   useFactory: (adapter: TemplateService) => adapter,
   * })
   * ```
   *
   * @param {TemplateModuleAsyncOptions} options - Factory, its injected dependencies, imports and global flag.
   * @returns {DynamicModule} A dynamic module that provides and exports the service.
   */
  static forRootAsync(options: TemplateModuleAsyncOptions): DynamicModule {
    const { isGlobal = false } = options;

    return {
      module: TemplateModule,
      global: isGlobal,
      imports: options.imports || [],
      providers: [
        {
          provide: TemplateService,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [TemplateService],
    };
  }
}
