import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';
import googleConfig from 'src/config/google.config';
import { User } from 'src/user/user.model';
import { Repository } from 'typeorm';
import { AuthType } from '../auth-types.enum';
import { AuthTokenService } from '../core/auth-token/auth-token.service';

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(this.constructor.name, {
    timestamp: true,
  });

  constructor(
    private oauthClient: OAuth2Client,
    @Inject(googleConfig.KEY)
    private googleConf: ConfigType<typeof googleConfig>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private authTokenService: AuthTokenService,
  ) {}

  async register(idToken: string): Promise<string> {
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: [
          this.googleConf.oauth.audience,
          this.googleConf.oauth.clientId,
        ],
      });
      const payload = ticket.getPayload();
      if (payload === undefined) {
        throw new RequestException(Exceptions.auth.invalidPayload);
      }
      const { name, email } = payload as { name: string; email: string };

      const existingUser = await this.userRepo.findOne({
        where: { email },
      });

      if (existingUser) {
        throw new RequestException(Exceptions.auth.alreadyExists);
      }

      const user = this.userRepo.create({});

      user.email = email;
      user.name = name;
      user.verified = true;
      user.authType = AuthType.GOOGLE;

      await this.userRepo.save(user);

      return this.authTokenService.generateAuthToken(user, AuthType.GOOGLE);
    } catch (e) {
      this.logger.error('Google login: ', e);
      if (e instanceof RequestException) {
        throw e;
      }
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }
  }

  async login(idToken: string): Promise<string> {
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: [
          this.googleConf.oauth.audience,
          this.googleConf.oauth.clientId,
        ],
      });
      const payload = ticket.getPayload();
      if (payload === undefined) {
        throw new RequestException(Exceptions.auth.invalidPayload);
      }
      const { email } = payload as { email: string };

      const existingUser = await this.userRepo.findOne({
        where: { email },
      });

      if (!existingUser || existingUser.authType !== AuthType.GOOGLE) {
        throw new RequestException(Exceptions.auth.invalidCredentials);
      }

      return this.authTokenService.generateAuthToken(
        existingUser,
        AuthType.GOOGLE,
      );
    } catch (e) {
      this.logger.error('Google login: ', e);
      if (e instanceof RequestException) {
        throw e;
      }
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }
  }
}
