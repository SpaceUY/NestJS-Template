import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions, ExtractJwt } from 'passport-jwt';
import { ConfigType } from '@nestjs/config';

import { User } from '../user/user.model';
import jwtConfig from '../config/jwt.config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthTokenPayload } from './core/auth-token/auth-token.service';

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

  async validate({ userId, type }: AuthTokenPayload): Promise<User> {
    if (type !== 'auth') {
      return null;
    }

    const user = await this.userRepo.findOne(userId);

    if (!user) {
      throw Error('User not found');
    }

    return user;
  }
}
