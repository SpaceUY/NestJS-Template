import { Inject, Module, Optional } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { OAuth2Client } from 'google-auth-library';
import { googleScope, GoogleScopeConfig } from './config/google.scope';
import { AuthTokenModule } from '../core/auth-token/auth-token.module';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { GoogleStrategy } from './google.strategy';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/observability/logger/nest-adapter/nest-logger.adapter';

@Module({
  imports: [PassportModule.register({}), AuthTokenModule],
  controllers: [GoogleController],
  providers: [
    GoogleStrategy,
    GoogleService,
    {
      provide: OAuth2Client,
      inject: [googleScope.KEY],
      useFactory: (googleConf: GoogleScopeConfig) =>
        new OAuth2Client(googleConf.clientId),
    },
  ],
})
export class GoogleModule {
  constructor(
    @Inject(googleScope.KEY)
    private readonly googleConf: GoogleScopeConfig,
    // See `GoogleService`: optional so `src/auth/` lifts without
    // `LoggerAbstractModule` registered.
    @Optional() logger?: LoggerService,
  ) {
    if (googleConf.enabled) return;

    const log = logger ?? new NestLoggerAdapter(GoogleModule.name);
    log.setContext(GoogleModule.name);
    log.error({
      message:
        "Google OAuth was marked as disabled but GoogleModule is still present; Please remove it from AuthModule's Imports",
    });
  }
}
