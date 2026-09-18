import { Inject, Logger, Module } from '@nestjs/common';
import { auth0Scope, Auth0ScopeConfig } from './config/auth0.scope';
import { AuthTokenModule } from '../core/auth-token/auth-token.module';
import { Auth0Controller } from './auth0.controller';
import { Auth0Service } from './auth0.service';

@Module({
  imports: [AuthTokenModule],
  controllers: [Auth0Controller],
  providers: [Auth0Service],
})
export class Auth0Module {
  private readonly logger = new Logger('Auth0Module', { timestamp: true });
  constructor(
    @Inject(auth0Scope.KEY)
    private readonly auth0Conf: Auth0ScopeConfig,
  ) {
    if (!auth0Conf.enabled) {
      this.logger.error(
        "Auth0 was marked as disabled but Auth0Module is still present; Please remove it from AuthModule's Imports",
      );
    }
  }
}
