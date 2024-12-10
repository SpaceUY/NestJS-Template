import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthType, User } from '@prisma/client';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';
import jwtConfig from 'src/config/jwt.config';

export interface AuthTokenPayload {
  userId: string;
  authType: AuthType;
  type: string;
}

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConf: ConfigType<typeof jwtConfig>,
  ) {}

  generateAuthToken(user: User, authType: AuthType): Promise<string> {
    return this.jwtService.signAsync({
      userId: user.id,
      authType,
      type: 'auth',
    } as AuthTokenPayload);
  }

  generateResetPasswordAuthToken(
    userId: string,
    authType: AuthTypeEnum,
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        userId,
        authType,
        type: 'auth',
      } as AuthTokenPayload,
      {
        secret: this.jwtConf.secretResetPassword,
        expiresIn: this.jwtConf.expiresInResetPassword,
      },
    );
  }

  validateAuthToken(token: string): Promise<AuthTokenPayload> {
    return this.jwtService.verifyAsync<AuthTokenPayload>(token);
  }

  validateAuthResetPasswordToken(token: string): AuthTokenPayload {
    try {
      return this.jwtService.verify<AuthTokenPayload>(token, {
        secret: this.jwtConf.secretResetPassword,
      });
    } catch (error) {
      throw new RequestException(Exceptions.auth.invalidResetCode);
    }
  }
}
