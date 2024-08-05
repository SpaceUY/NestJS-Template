import { Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AuthType } from '@prisma/client';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import googleConfig from 'src/config/google.config';
import { PrismaService } from '../../prisma/prisma.service';

export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(googleConfig.KEY)
    private readonly googleConf: ConfigType<typeof googleConfig>,
    private readonly prisma: PrismaService,
  ) {
    super({
      clientID: googleConf.oauth.clientId,
      clientSecret: googleConf.oauth.secret,
      callbackURL: googleConf.oauth.callbackURL,
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
