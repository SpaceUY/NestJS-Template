import { Inject, Module, Optional } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuth2Client } from 'google-auth-library';
import { googleScope, GoogleScopeConfig } from './config/google.scope';
import { AuthTokenModule } from '../core/auth-token/auth-token.module';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { GoogleStrategy } from './google.strategy';
import { User } from '../../database/entities/user.entity';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/observability/logger/nest-adapter/nest-logger.adapter';

@Module({
  imports: [PassportModule.register({}), AuthTokenModule],
  controllers: [GoogleController],
  providers: [
    // The strategy is built by hand rather than listed as a class provider
    // because `GoogleStrategy`'s constructor calls passport's
    // `OAuth2Strategy`, which throws `OAuth2Strategy requires a clientID
    // option` when there is no client id — exactly the state a disabled
    // provider is in. `enabled: false` therefore has to mean "never
    // constructed", not "constructed and then ignored": the scope is resolved
    // asynchronously, so the flag is only readable inside a factory, and this
    // is the earliest point that can see it. Resolving to `null` keeps the
    // token injectable; nothing outside this module injects it.
    {
      provide: GoogleStrategy,
      inject: [googleScope.KEY, getRepositoryToken(User)],
      useFactory: (
        googleConf: GoogleScopeConfig,
        userRepository: Repository<User>,
      ): GoogleStrategy | null =>
        googleConf.enabled
          ? new GoogleStrategy(googleConf, userRepository)
          : null,
    },
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
    // Not an error: a disabled provider is a supported state now. What the
    // line says is what the flag cannot do on its own — the controller is
    // still declared in the metadata above, so `/auth/google/*` stays mapped
    // (answering 404 through `GoogleEnabledGuard`) and stays in the Swagger
    // document until the import is removed.
    log.warn({
      message:
        "Google OAuth is disabled: the Passport strategy is not registered and every /auth/google route answers 404. Remove GoogleModule from AuthModule's imports to unmap the routes entirely.",
    });
  }
}
