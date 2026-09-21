import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuth2Client } from 'google-auth-library';
import { RequestException } from '../../common/exception/core/ExceptionBase';
import { Exceptions } from '../../common/exception/exceptions';
import { googleScope, GoogleScopeConfig } from './config/google.scope';
import { User } from '../../database/entities/user.entity';
import { AuthType } from '../../database/entities/auth-type.enum';
import { AuthTokenService } from '../core/auth-token/auth-token.service';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/observability/logger/nest-adapter/nest-logger.adapter';

@Injectable()
export class GoogleService {
  private readonly logger: LoggerService;

  constructor(
    private oauthClient: OAuth2Client,
    @Inject(googleScope.KEY)
    private readonly googleConf: GoogleScopeConfig,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private authTokenService: AuthTokenService,
    // Optional so `src/auth/` still boots in a project that copies it without
    // registering `LoggerAbstractModule`; injected, it brings the trace id and
    // the telemetry hook the container's logger is wired with.
    @Optional() logger?: LoggerService,
  ) {
    this.logger = logger ?? new NestLoggerAdapter(GoogleService.name);
    this.logger.setContext(GoogleService.name);
  }

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
      if (e instanceof RequestException) {
        throw e;
      }
      this._logProviderFailure('register', e);
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

      if (existingUser?.authType !== AuthType.GOOGLE) {
        throw new RequestException(Exceptions.auth.invalidCredentials);
      }

      return this.authTokenService.generateAuthToken(
        existingUser,
        AuthType.GOOGLE,
      );
    } catch (e) {
      if (e instanceof RequestException) {
        throw e;
      }
      this._logProviderFailure('login', e);
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }
  }

  /**
   * Logs the kind of failure and nothing else. A rejected `verifyIdToken`
   * carries the submitted ID token in its message, so logging the error
   * object — or its message — writes a credential to the log (finding `C5`).
   */
  private _logProviderFailure(operation: string, e: unknown): void {
    // No `error:` field for the same reason: the adapters serialize it, and
    // this one's message is the credential.
    this.logger.error({
      message: 'Google provider call failed',
      data: { operation, kind: e instanceof Error ? e.name : typeof e },
    });
  }
}
