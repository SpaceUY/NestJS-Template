import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { ResendAdapterService } from './resend-adapter.service';
import { ResendAdapterConfig } from './resend-adapter-config.interface';
import { RESEND_ADAPTER_PROVIDER_CONFIG } from './resend-adapter-config-provider.const';
import { EMAIL_PROVIDER } from '../abstract/email-provider.const';
import { EmailTemplateService } from '../abstract/templates.abstract';
import { EMAIL_TEMPLATE_SERVICE } from '../abstract/template-provider.const';

@Module({})
export class ResendAdapterModule {
  static register(config: ResendAdapterConfig): DynamicModule {
    return {
      module: ResendAdapterModule,
      providers: [
        {
          provide: RESEND_ADAPTER_PROVIDER_CONFIG,
          useValue: config,
        },
        {
          provide: EMAIL_TEMPLATE_SERVICE,
          useValue: EmailTemplateService,
        },
        {
          provide: EMAIL_PROVIDER,
          useClass: ResendAdapterService,
        },
      ],
      exports: [
        EMAIL_PROVIDER,
        EMAIL_TEMPLATE_SERVICE,
        RESEND_ADAPTER_PROVIDER_CONFIG,
      ],
    };
  }

  static registerAsync(options: {
    imports?: ModuleMetadata['imports'];
    inject?: InjectionToken[];
    useFactory: (
      ...args: unknown[]
    ) => Promise<ResendAdapterConfig> | ResendAdapterConfig;
  }): DynamicModule {
    return {
      module: ResendAdapterModule,
      imports: options.imports || [],
      providers: [
        {
          provide: RESEND_ADAPTER_PROVIDER_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: EMAIL_TEMPLATE_SERVICE,
          useValue: EmailTemplateService,
        },
        {
          provide: EMAIL_PROVIDER,
          useClass: ResendAdapterService,
        },
      ],
      exports: [
        EMAIL_PROVIDER,
        EMAIL_TEMPLATE_SERVICE,
        RESEND_ADAPTER_PROVIDER_CONFIG,
      ],
    };
  }
}
