import { Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthType } from '@prisma/client';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { googleScope, GoogleScopeConfig } from './config/google.scope';
import { PrismaService } from '../../prisma/prisma.service';

export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(googleScope.KEY)
    private readonly googleConf: GoogleScopeConfig,
    private readonly prisma: PrismaService,
  ) {
    super({
      clientID: googleConf.clientId,
      clientSecret: googleConf.clientSecret,
      callbackURL: googleConf.callbackUrl,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const email = profile.emails[0].value;
      const existingUser = await this.prisma.user.findFirst({
        where: { email },
      });

      if (existingUser) {
        return done(null, existingUser);
      }

      const user = await this.prisma.user.create({
        data: {
          email,
          name: `${profile.name.givenName} ${profile.name.familyName}`,
          verified: true,
          authType: AuthType.GOOGLE,
        },
      });

      return done(null, user);
    } catch (e) {
      return done(e);
    }
  }
}
