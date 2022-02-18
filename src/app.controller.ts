import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AppService } from './app.service';
import { Html } from './common/decorators/html-content-type';
import baseConfig from './config/base.config';
import { EmailType } from './email/core/email-type';
import testEmail from './email/emails/test.email';
import test2Email from './email/emails/test2.email';
import { TemplateType } from './template/core/template-core.module';
import testTemplate from './template/templates/test/test.template';
import test2Template from './template/templates/test2/test2.template';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(baseConfig.KEY)
    private readonly baseConf: ConfigType<typeof baseConfig>,
    @Inject(testTemplate.KEY)
    private readonly testTemp: TemplateType<typeof testTemplate>,
    @Inject(testEmail.KEY)
    private readonly testMail: EmailType<typeof testEmail>,
    @Inject(test2Template.KEY)
    private readonly test2Temp: TemplateType<typeof test2Template>,
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

  @Get('test2')
  @Html()
  test2(): string {
    return this.test2Temp.compileHTML({ name: 'Ilan', amount: 300 });
  }

  @Get('email')
  async sendEmail(): Promise<void> {
    await this.test2Mail.send('igarcia@spacedev.uy', {
      name: 'Ilan',
      amount: 300,
    });
  }
}
