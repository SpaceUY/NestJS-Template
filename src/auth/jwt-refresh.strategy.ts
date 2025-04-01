import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';

import { User } from '@prisma/client';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';
import jwtConfig from '../config/jwt.config';
import { AuthTokenPayload } from './core/auth-token/auth-token.service';
import { AuthService } from './auth.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    @Inject(jwtConfig.KEY)
    jwtConf: ConfigType<typeof jwtConfig>,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: jwtConf.ignoreExpiration,
      secretOrKey: jwtConf.secretRefreshToken,
    } as StrategyOptions);
  }

  async validate({ userId, type }: AuthTokenPayload): Promise<User | null> {
    const user = await this.authService.validateUser(userId, type);
    if (!user) {
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }
    return user;
  }
}
