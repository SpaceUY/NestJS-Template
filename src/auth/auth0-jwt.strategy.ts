import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';
import { auth0Scope, Auth0ScopeConfig } from './config/auth0.scope';
import { passportJwtSecret } from 'jwks-rsa';
import axios from 'axios';
import { Request } from 'express';
import { User } from '../database/entities/user.entity';
import { AuthType } from './core/auth-type.enum';

interface Auth0UserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

@Injectable()
export class Auth0JwtStrategy extends PassportStrategy(Strategy, 'auth0-jwt') {
  constructor(
    @Inject(auth0Scope.KEY)
    private readonly auth0Conf: Auth0ScopeConfig,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: auth0Conf.audience,
      issuer: auth0Conf.issuer,
      algorithms: ['RS256'],
      passReqToCallback: true,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: auth0Conf.jwksUri,
      }),
    });
  }

  async validate(req: Request, payload: jwt.JwtPayload): Promise<User> {
    if (!payload || !payload.sub) {
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }
    const token = authHeader.substring(7);
    const userInfo = await this.getUserInfo(token);

    if (!userInfo.email_verified) {
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }

    let user = await this.userRepository.findOne({
      where: { auth0Id: userInfo.sub },
    });

    if (!user) {
      user = await this.userRepository.save(
        this.userRepository.create({
          auth0Id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name || userInfo.email.split('@')[0],
          verified: userInfo.email_verified,
          authType: AuthType.AUTH0,
        }),
      );
    } else {
      const expectedName = userInfo.name || userInfo.email.split('@')[0];
      if (user.email !== userInfo.email || user.name !== expectedName) {
        Object.assign(user, {
          email: userInfo.email,
          name: expectedName,
          verified: userInfo.email_verified,
        });
        user = await this.userRepository.save(user);
      }
    }

    return user;
  }

  private async getUserInfo(accessToken: string): Promise<Auth0UserInfo> {
    try {
      const response = await axios.get(`${this.auth0Conf.issuer}userinfo`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return response.data;
    } catch {
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }
  }
}
