import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { jwtScope, JwtScopeConfig } from '../../config/jwt.scope';
import { AuthTokenService } from './auth-token.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (jwtConf: JwtScopeConfig) => ({
        secret: jwtConf.secret,
        signOptions: jwtConf.ignoreExpiration
          ? {}
          : { expiresIn: jwtConf.expiresIn as StringValue },
      }),
      inject: [jwtScope.KEY],
    }),
  ],
  providers: [AuthTokenService],
  exports: [AuthTokenService, JwtModule],
})
export class AuthTokenModule {}
