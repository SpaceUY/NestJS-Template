import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { googleScope, GoogleScopeConfig } from './config/google.scope';
import { User } from '../../database/entities/user.entity';
import { AuthType } from '../core/auth-type.enum';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(googleScope.KEY)
    private readonly googleConf: GoogleScopeConfig,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
