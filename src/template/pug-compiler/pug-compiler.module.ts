import { Module } from "@nestjs/common";
import { PugCompilerService } from "./pug-compiler.service";
import { EMAIL_TEMPLATE_SERVICE } from "../../email/abstract/template-provider.const";
import { EmailTemplateService } from "../../email/abstract/templates.abstract";

@Module({
  providers: [
    {
      provide: EMAIL_TEMPLATE_SERVICE,
      useClass: PugCompilerService,
    },
    {
      provide: EmailTemplateService,
      useExisting: EMAIL_TEMPLATE_SERVICE,
    },
  ],
  exports: [EMAIL_TEMPLATE_SERVICE, EmailTemplateService],
})
export class PugCompilerModule {}
