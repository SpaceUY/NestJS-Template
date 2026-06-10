import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import googleConfig from 'src/config/google.config';
import { User } from '../../user/user.entity';
import { AuthType } from '../core/auth-type.enum';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(googleConfig.KEY)
    private readonly googleConf: ConfigType<typeof googleConfig>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
      const existingUser = await this.userRepository.findOne({
        where: { email },
      });

      if (existingUser) {
        return done(null, existingUser);
      }

      const user = this.userRepository.create({
        email,
        name: `${profile.name.givenName} ${profile.name.familyName}`,
        verified: true,
        authType: AuthType.GOOGLE,
      });
      await this.userRepository.save(user);

      return done(null, user);
    } catch (e) {
      return done(e);
    }
  }
}
