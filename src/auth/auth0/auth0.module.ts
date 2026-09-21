import { Inject, Module, Optional } from '@nestjs/common';
import { auth0Scope, Auth0ScopeConfig } from './config/auth0.scope';
import { AuthTokenModule } from '../core/auth-token/auth-token.module';
import { Auth0Controller } from './auth0.controller';
import { Auth0Service } from './auth0.service';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/observability/logger/nest-adapter/nest-logger.adapter';

@Module({
  imports: [AuthTokenModule],
  controllers: [Auth0Controller],
  providers: [Auth0Service],
})
export class Auth0Module {
  constructor(
    @Inject(auth0Scope.KEY)
    private readonly auth0Conf: Auth0ScopeConfig,
    // See `GoogleService`: optional so `src/auth/` lifts without
    // `LoggerAbstractModule` registered.
    @Optional() logger?: LoggerService,
  ) {
    if (auth0Conf.enabled) return;

    const log = logger ?? new NestLoggerAdapter(Auth0Module.name);
    log.setContext(Auth0Module.name);
    log.error({
      message:
        "Auth0 was marked as disabled but Auth0Module is still present; Please remove it from AuthModule's Imports",
    });
  }
}
