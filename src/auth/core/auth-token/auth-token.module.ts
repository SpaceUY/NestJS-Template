import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import jwtConfig from 'src/config/jwt.config';
import { AuthTokenService } from './auth-token.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (jwtConf: ConfigType<typeof jwtConfig>) => ({
        secret: jwtConf.secret,
        signOptions: jwtConf.ignoreExpiration
          ? {}
          : { expiresIn: jwtConf.expiresIn as StringValue },
      }),
      inject: [jwtConfig.KEY],
    }),
  ],
  providers: [AuthTokenService],
  exports: [AuthTokenService, JwtModule],
})
export class AuthTokenModule {}
