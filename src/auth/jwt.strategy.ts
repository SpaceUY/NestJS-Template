import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions, ExtractJwt } from 'passport-jwt';
import { ConfigType } from '@nestjs/config';

import { User } from '../user/user.model';
import jwtConfig from '../config/jwt.config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthTokenPayload } from './core/auth-token/auth-token.service';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(jwtConfig.KEY)
    jwtConf: ConfigType<typeof jwtConfig>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: jwtConf.ignoreExpiration,
      secretOrKey: jwtConf.secret,
    } as StrategyOptions);
  }

  async validate({ userId, type }: AuthTokenPayload): Promise<User | null> {
    if (type !== 'auth') {
      return null;
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }

    return user;
  }
}
