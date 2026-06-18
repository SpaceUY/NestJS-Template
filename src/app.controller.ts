import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { appScope, AppScopeConfig } from './app.scope';
import { emailScope, EmailScopeConfig } from './email/config/email.scope';
import { EmailService } from './email/abstract/email.service';
import { TEMPLATES } from './templates';
import { TEMPLATE_PATHS } from './templates/template.const';
import { TemplateService } from './templating/abstract/template.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(appScope.KEY)
    private readonly appConf: AppScopeConfig,
    @Inject(emailScope.KEY)
    private readonly emailConf: EmailScopeConfig,
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello() + ' ' + this.appConf.nodeEnv;
  }

  @Get('email')
  async sendEmail(): Promise<void> {
    const html = await this.templateService.compile(
      TEMPLATE_PATHS[TEMPLATES.WELCOME],
      {
        name: 'John Doe',
      },
    );

    await this.emailService.sendEmail({
      to: 'johndoe@example.com',
      subject: 'Welcome to our app',
      from: this.emailConf.from,
      content: { html },
    });
  }
}
