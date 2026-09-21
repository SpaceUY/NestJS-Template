import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ExtractJwt,
  Strategy,
  StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import { RequestException } from '../common/exception/core/ExceptionBase';
import { Exceptions } from '../common/exception/exceptions';
import { jwtScope, type JwtScopeConfig } from './config/jwt.scope';
import { User } from '../database/entities/user.entity';
import { AuthTokenPayload } from './core/auth-token/auth-token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(jwtScope.KEY)
    jwtConf: JwtScopeConfig,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: jwtConf.ignoreExpiration,
      secretOrKey: jwtConf.secret,
    };
    super(options);
  }

  async validate({ userId, type }: AuthTokenPayload): Promise<User | null> {
    if (type !== 'auth') {
      return null;
    }

    const user = await this.userRepository.findOne({ where: { uuid: userId } });

    if (!user) {
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }

    return user;
  }
}
