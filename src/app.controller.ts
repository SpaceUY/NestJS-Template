import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AppService } from './app.service';
import baseConfig from './config/base.config';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(baseConfig.KEY)
    private readonly baseConf: ConfigType<typeof baseConfig>,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello() + ' ' + this.baseConf.nodeEnv;
  }
}
