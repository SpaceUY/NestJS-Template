import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestException } from '../../common/exception/core/ExceptionBase';
import { Exceptions } from '../../common/exception/exceptions';
import { User } from '../../database/entities/user.entity';
import { AuthType } from '../../database/entities/auth-type.enum';
import { AuthTokenService } from '../core/auth-token/auth-token.service';
import { auth0Scope, Auth0ScopeConfig } from './config/auth0.scope';

interface Auth0UserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
}

@Injectable()
export class Auth0Service {
  private readonly logger = new Logger(this.constructor.name, {
    timestamp: true,
  });

  constructor(
    @Inject(auth0Scope.KEY)
    private readonly auth0Conf: Auth0ScopeConfig,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async login(accessToken: string): Promise<string> {
    try {
      const userInfo = await this.fetchUserInfo(accessToken);
      // /userinfo only proves the token is a genuine, unexpired Auth0 token —
      // not that it was minted for this API. A token issued for a different
      // application under the same tenant would still pass. The token's
      // signature is already Auth0-verified at this point (the /userinfo call
      // above failed otherwise), so reading its claims here without a local
      // JWKS check is safe and only guards against token substitution.
      this.assertIntendedForThisApi(accessToken);
      if (!userInfo.email_verified) {
        throw new RequestException(Exceptions.auth.invalidCredentials);
      }

      const name = userInfo.name || userInfo.email.split('@')[0];
      const existingUser = await this.userRepository.findOne({
        where: { auth0Id: userInfo.sub },
      });

      if (existingUser) {
        if (
          existingUser.email !== userInfo.email ||
          existingUser.name !== name
        ) {
          existingUser.email = userInfo.email;
          existingUser.name = name;
          await this.userRepository.save(existingUser);
        }
        return this.authTokenService.generateAuthToken(
          existingUser,
          AuthType.AUTH0,
        );
      }

      const user = this.userRepository.create({
        auth0Id: userInfo.sub,
        email: userInfo.email,
        name,
        verified: true,
        authType: AuthType.AUTH0,
      });
      await this.userRepository.save(user);

      return this.authTokenService.generateAuthToken(user, AuthType.AUTH0);
    } catch (e) {
      if (!(e instanceof RequestException)) {
        this.logger.error('Auth0 login failed');
      }
      if (e instanceof RequestException) {
        throw e;
      }
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }
  }

  private async fetchUserInfo(accessToken: string): Promise<Auth0UserInfo> {
    const response = await fetch(`${this.auth0Conf.issuer}userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }
    return (await response.json()) as Auth0UserInfo;
  }

  private assertIntendedForThisApi(accessToken: string): void {
    const payload = this.decodeJwtPayload(accessToken);
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

    if (
      payload.iss !== this.auth0Conf.issuer ||
      !audience.includes(this.auth0Conf.audience)
    ) {
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }
  }

  private decodeJwtPayload(token: string): Record<string, unknown> {
    try {
      const [, payload] = token.split('.');
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }
  }
}
