import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';
import { jwtScope, JwtScopeConfig } from './config/jwt.scope';
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

    const user = await this.userRepository.findOne({ where: { uuid: userId } });

    if (!user) {
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }

    return user;
  }
}
