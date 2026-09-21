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

// `TArgs` is the tuple of values the `inject` tokens resolve to. It is inferred
// from the factory at the call site, which is what keeps a typed factory —
// `(config: SomeScopeConfig) => ...` — assignable here. A plain `unknown[]`
// would reject it: function parameters are contravariant.
interface TemplateModuleAsyncOptions<TArgs extends unknown[] = unknown[]> {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (...args: TArgs) => Promise<TemplateService> | TemplateService;
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
  static forRootAsync<TArgs extends unknown[]>(
    options: TemplateModuleAsyncOptions<TArgs>,
  ): DynamicModule {
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
