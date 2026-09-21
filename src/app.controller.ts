import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { appScope, AppScopeConfig } from './app.scope';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(appScope.KEY)
    private readonly appConf: AppScopeConfig,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello() + ' ' + this.appConf.nodeEnv;
  }
}
