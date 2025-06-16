import { DynamicModule, ForwardReference, Module, Type } from "@nestjs/common";
import { EMAIL_PROVIDER } from "./email-provider.const";
import { EmailService } from "./email.service";
import { EMAIL_TEMPLATE_SERVICE } from "./template-provider.const";
import { EmailTemplateService } from "./templates.abstract";

type AdapterModule =
  | Type<any>
  | DynamicModule
  | Promise<DynamicModule>
  | ForwardReference;

interface EmailModuleOptions {
  adapter: AdapterModule;
  templateService: AdapterModule;
  useDefaultController?: boolean;
  isGlobal?: boolean;
  customController?: Type<any>[];
}

@Module({})
export class EmailAbstractModule {
  static forRoot(options: EmailModuleOptions): DynamicModule {
    const { adapter, templateService, isGlobal = false } = options;
    return {
      module: EmailAbstractModule,
      global: isGlobal,
      providers: [
        {
          provide: EmailTemplateService,
          useFactory: (templateService: EmailTemplateService) =>
            templateService,
          inject: [EMAIL_TEMPLATE_SERVICE],
        },
        {
          provide: EmailService,
          useFactory: (adapter: EmailService) => adapter,
          inject: [EMAIL_PROVIDER],
        },
      ],
      imports: [adapter, templateService],
      exports: [EmailService, EmailTemplateService],
    };
  }
}
