import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';
import auth0Config from '../config/auth0.config';
import { PrismaService } from '../prisma/prisma.service';
import { passportJwtSecret } from 'jwks-rsa';
import axios from 'axios';
import { Request } from 'express';

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
    @Inject(auth0Config.KEY)
    private readonly auth0Conf: ConfigType<typeof auth0Config>,
    private readonly prisma: PrismaService,
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

    // Extract the raw token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }
    const token = authHeader.substring(7);
    const userInfo = await this.getUserInfo(token);

    if (!userInfo.email_verified) {
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }

    let user = await this.prisma.user.findUnique({
      where: { auth0Id: userInfo.sub },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          auth0Id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name || userInfo.email.split('@')[0],
          verified: userInfo.email_verified,
          authType: 'AUTH0',
        },
      });
    } else {
      const expectedName = userInfo.name || userInfo.email.split('@')[0];
      if (user.email !== userInfo.email || user.name !== expectedName) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            email: userInfo.email,
            name: expectedName,
            verified: userInfo.email_verified,
          },
        });
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
