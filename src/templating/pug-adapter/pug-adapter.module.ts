import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { TEMPLATE_PROVIDER } from '../abstract/template-provider.const';
import { TemplateService } from '../abstract/template.service';
import { PugAdapterService } from './pug-adapter.service';

export interface PugAdapterConfig {
  baseDir?: string;
}

@Module({})
export class PugAdapterModule {
  static register(config: PugAdapterConfig = {}): DynamicModule {
    return {
      module: PugAdapterModule,
      providers: [
        {
          provide: TEMPLATE_PROVIDER,
          useFactory: () => new PugAdapterService(config),
        },
        {
          provide: TemplateService,
          useExisting: TEMPLATE_PROVIDER,
        },
      ],
      exports: [TEMPLATE_PROVIDER, TemplateService],
    };
  }

  // `TArgs` is the tuple of values the `inject` tokens resolve to, inferred
  // from the factory at the call site. `unknown[]` would reject a typed
  // factory: function parameters are contravariant (`T6`).
  static registerAsync<TArgs extends unknown[]>(options: {
    imports?: ModuleMetadata['imports'];
    inject?: InjectionToken[];
    useFactory: (
      ...args: TArgs
    ) => Promise<PugAdapterConfig> | PugAdapterConfig;
  }): DynamicModule {
    return {
      module: PugAdapterModule,
      imports: options.imports || [],
      providers: [
        {
          provide: TEMPLATE_PROVIDER,
          useFactory: async (...args: TArgs) => {
            const cfg = await options.useFactory(...args);
            return new PugAdapterService(cfg);
          },
          inject: options.inject || [],
        },
        {
          provide: TemplateService,
          useExisting: TEMPLATE_PROVIDER,
        },
      ],
      exports: [TEMPLATE_PROVIDER, TemplateService],
    };
  }
}
