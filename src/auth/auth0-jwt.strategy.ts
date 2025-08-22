import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

import { User } from '@prisma/client';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';
import auth0Config from '../config/auth0.config';
import { PrismaService } from '../prisma/prisma.service';

export interface Auth0JwtPayload {
  sub: string; // Auth0 user ID
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
}

@Injectable()
export class Auth0JwtStrategy extends PassportStrategy(Strategy, 'auth0-jwt') {
  constructor(
    @Inject(auth0Config.KEY)
    private readonly auth0Conf: ConfigType<typeof auth0Config>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: auth0Conf.audience,
      issuer: auth0Conf.issuer,
      algorithms: ['RS256'],
      secretOrKey: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: auth0Conf.jwksUri,
      }),
    } as StrategyOptions);
  }

  async validate(payload: Auth0JwtPayload): Promise<User> {
    if (!payload.email_verified) {
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }

    let user = await this.prisma.user.findUnique({
      where: { auth0Id: payload.sub },
    });

    if (!user) {
      // Create user if they don't exist
      user = await this.prisma.user.create({
        data: {
          auth0Id: payload.sub,
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          verified: payload.email_verified,
          authType: 'AUTH0',
        },
      });
    } else {
      // Update user information if needed
      if (
        user.email !== payload.email ||
        user.name !== (payload.name || payload.email.split('@')[0])
      ) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            verified: payload.email_verified,
          },
        });
      }
    }

    return user;
  }
}
