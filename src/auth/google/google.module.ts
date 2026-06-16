import { Inject, Logger, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { OAuth2Client } from 'google-auth-library';
import { googleScope, GoogleScopeConfig } from './config/google.scope';
import { AuthTokenModule } from '../core/auth-token/auth-token.module';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { GoogleStrategy } from './google.strategy';

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
  private readonly logger = new Logger('GoogleModule', { timestamp: true });
  constructor(
    @Inject(googleScope.KEY)
    private readonly googleConf: GoogleScopeConfig,
  ) {
    if (!googleConf.enabled) {
      this.logger.error(
        "Google OAuth was marked as disabled but GoogleModule is still present; Please remove it from AuthModule's Imports",
      );
    }
  }
}
