import { DynamicModule, ForwardReference, Module, Type } from '@nestjs/common';
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

@Module({})
export class TemplateModule {
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
}
