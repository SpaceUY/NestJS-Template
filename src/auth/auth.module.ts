import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GoogleModule } from './google/google.module';
import { Auth0Module } from './auth0/auth0.module';
import { JwtStrategy } from './jwt.strategy';
import { AuthTokenModule } from './core/auth-token/auth-token.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    GoogleModule,
    Auth0Module,
    AuthTokenModule,
  ],
  providers: [JwtStrategy],
  exports: [JwtStrategy, PassportModule],
})
export class AuthModule {}
