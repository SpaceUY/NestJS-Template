import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AppService } from './app.service';
import baseConfig from './config/base.config';
import emailConfig from './config/email.config';
import { EmailService } from './email/abstract/email.service';
import { TEMPLATES } from './templates';
import { TEMPLATE_PATHS } from './templates/template.const';
import { TemplateService } from './templating/abstract/template.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(baseConfig.KEY)
    private readonly baseConf: ConfigType<typeof baseConfig>,
    @Inject(emailConfig.KEY)
    private readonly emailConf: ConfigType<typeof emailConfig>,
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello() + ' ' + this.baseConf.nodeEnv;
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
      to: 'econtrerasvale@gmail.com',
      subject: 'Test',
      from: this.emailConf.from,
      content: { html },
    });
  }
}
