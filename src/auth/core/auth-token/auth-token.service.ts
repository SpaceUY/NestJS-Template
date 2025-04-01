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

  async generateAuthTokens(
    user: User,
    authType: AuthType,
  ): Promise<{ token: string; refreshToken: string }> {
    const token = this.jwtService.sign(
      {
        userId: user.id,
        authType,
        type: 'auth',
      } as AuthTokenPayload,
      {
        secret: this.jwtConf.secret,
        expiresIn: this.jwtConf.expiresIn,
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        userId: user.id,
        authType,
        type: 'auth',
      } as AuthTokenPayload,
      {
        secret: this.jwtConf.secretRefreshToken,
        expiresIn: this.jwtConf.expiresInRefreshToken,
      },
    );
    return { token, refreshToken };
  }

  generateResetPasswordAuthToken(
    userId: string,
    authType: AuthType,
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
