import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { AppService } from './app.service';
import { Html } from './common/decorators/html-content-type';
import baseConfig from './config/base.config';
import { EmailType } from './email/core/email-type';
import test2Email from './email/emails/test2.email';
import { TemplateType } from './template/core/template-core.module';
import testTemplate from './template/templates/test/test.template';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(baseConfig.KEY)
    private readonly baseConf: ConfigType<typeof baseConfig>,
    @Inject(testTemplate.KEY)
    private readonly testTemp: TemplateType<typeof testTemplate>,
    @Inject(test2Email.KEY)
    private readonly test2Mail: EmailType<typeof test2Email>,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello() + ' ' + this.baseConf.nodeEnv;
  }

  @Get('template')
  @Html()
  template(): string {
    return this.testTemp.compileHTML({ a: 'A', b: 'B' });
  }

  @Get('email')
  async sendEmail(): Promise<void> {
    await this.test2Mail.send('nestjstemplate@mailinator.com', {
      name: 'Test',
      amount: 300,
    });
  }
}
