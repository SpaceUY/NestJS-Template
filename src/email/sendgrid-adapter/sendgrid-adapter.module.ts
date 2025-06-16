import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from "@nestjs/common";
import { SendgridAdapterService } from "./sendgrid-adapter.service";
import { SendgridAdapterConfig } from "./sendgrid-adapter-config.interface";
import { SENDGRID_ADAPTER_PROVIDER_CONFIG } from "./sendgrid-adapter-config-provider.const";
import { EMAIL_PROVIDER } from "../abstract/email-provider.const";
import { EmailTemplateService } from "../abstract/templates.abstract";
import { EMAIL_TEMPLATE_SERVICE } from "../abstract/template-provider.const";

@Module({})
export class SendgridAdapterModule {
  static register(config: SendgridAdapterConfig): DynamicModule {
    return {
      module: SendgridAdapterModule,
      providers: [
        {
          provide: SENDGRID_ADAPTER_PROVIDER_CONFIG,
          useValue: config,
        },
        {
          provide: EMAIL_TEMPLATE_SERVICE,
          useValue: EmailTemplateService,
        },
        {
          provide: EMAIL_PROVIDER,
          useClass: SendgridAdapterService,
        },
      ],
      exports: [
        EMAIL_PROVIDER,
        EMAIL_TEMPLATE_SERVICE,
        SENDGRID_ADAPTER_PROVIDER_CONFIG,
      ],
    };
  }

  static registerAsync(options: {
    imports?: ModuleMetadata["imports"];
    inject?: InjectionToken[];
    useFactory: (
      ...args: any[]
    ) => Promise<SendgridAdapterConfig> | SendgridAdapterConfig;
  }): DynamicModule {
    return {
      module: SendgridAdapterModule,
      imports: options.imports || [],
      providers: [
        {
          provide: SENDGRID_ADAPTER_PROVIDER_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: EMAIL_TEMPLATE_SERVICE,
          useValue: EmailTemplateService,
        },
        {
          provide: EMAIL_PROVIDER,
          useClass: SendgridAdapterService,
        },
      ],
      exports: [
        EMAIL_PROVIDER,
        EMAIL_TEMPLATE_SERVICE,
        SENDGRID_ADAPTER_PROVIDER_CONFIG,
      ],
    };
  }
}
