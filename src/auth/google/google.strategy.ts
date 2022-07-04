import { Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import googleConfig from 'src/config/google.config';
import { User } from 'src/user/user.model';
import { Repository } from 'typeorm';
import { AuthType } from '../auth-types.enum';

export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(googleConfig.KEY)
    private readonly googleConf: ConfigType<typeof googleConfig>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
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
      const existingUser = await this.UserModel.findOne({ email });
      if (existingUser) {
        return done(null, existingUser);
      }

      const user = this.userRepo.create();

      user.email = email;
      user.name = `${profile.name.givenName} ${profile.name.familyName}`;
      user.verified = true;
      user.authType = AuthType.GOOGLE;

      return done(null, await this.userRepo.save(user));
    } catch (e) {
      return done(e);
    }
  }
}
