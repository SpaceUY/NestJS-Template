import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuth2Client } from 'google-auth-library';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';
import { googleScope, GoogleScopeConfig } from './config/google.scope';
import { User } from '../../database/entities/user.entity';
import { AuthType } from '../core/auth-type.enum';
import { AuthTokenService } from '../core/auth-token/auth-token.service';

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(this.constructor.name, {
    timestamp: true,
  });

  constructor(
    private oauthClient: OAuth2Client,
    @Inject(googleScope.KEY)
    private readonly googleConf: GoogleScopeConfig,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private authTokenService: AuthTokenService,
  ) {}

  async register(idToken: string): Promise<string> {
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: [this.googleConf.audience, this.googleConf.clientId],
      });
      const payload = ticket.getPayload();
      if (payload === undefined) {
        throw new RequestException(Exceptions.auth.invalidPayload);
      }
      const { name, email } = payload as { name: string; email: string };

      const existingUser = await this.userRepository.findOne({
        where: { email },
      });

      if (existingUser) {
        throw new RequestException(Exceptions.auth.alreadyExists);
      }

      const user = this.userRepository.create({
        email,
        name,
        authType: AuthType.GOOGLE,
      });
      await this.userRepository.save(user);

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
        audience: [this.googleConf.audience, this.googleConf.clientId],
      });
      const payload = ticket.getPayload();
      if (payload === undefined) {
        throw new RequestException(Exceptions.auth.invalidPayload);
      }
      const { email } = payload as { email: string };

      const existingUser = await this.userRepository.findOne({
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
