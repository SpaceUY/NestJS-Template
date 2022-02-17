import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AppService } from './app.service';
import { Html } from './common/decorators/html-content-type';
import baseConfig from './config/base.config';
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
}
