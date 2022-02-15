import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthType } from 'src/auth/auth-types.enum';
import { User } from 'src/user/user.model';

export interface AuthTokenPayload {
  userId: string;
  authType: AuthType;
  type: string;
}

@Injectable()
export class AuthTokenService {
  constructor(private readonly jwtService: JwtService) {}

  generateAuthToken(user: User, authType: AuthType): Promise<string> {
    return this.jwtService.signAsync({
      userId: user.id,
      authType,
      type: 'auth',
    } as AuthTokenPayload);
  }

  validateAuthToken(token: string): Promise<AuthTokenPayload> {
    return this.jwtService.verifyAsync<AuthTokenPayload>(token);
  }
}
