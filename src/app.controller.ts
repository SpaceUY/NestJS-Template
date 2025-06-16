import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AppService } from './app.service';
import baseConfig from './config/base.config';
import emailConfig from './config/email.config';
import { EmailService } from './email/abstract/email.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(baseConfig.KEY)
    private readonly baseConf: ConfigType<typeof baseConfig>,
    @Inject(emailConfig.KEY)
    private readonly emailConf: ConfigType<typeof emailConfig>,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello() + ' ' + this.baseConf.nodeEnv;
  }

  @Get('email')
  async sendEmail(): Promise<void> {
    await this.emailService.sendEmail({
      to: 'nestjstemplate@mailinator.com',
      subject: 'Test',
      from: this.emailConf.from,
      content: {
        html: '<p>Test</p>',
      },
    });
  }
}
