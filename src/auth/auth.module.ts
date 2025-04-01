import { Module } from '@nestjs/common';
import { GoogleModule } from './google/google.module';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { AuthTokenModule } from './core/auth-token/auth-token.module';
import { BasicAuthModule } from './basic/basic-auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    GoogleModule,
    PrismaModule,
    AuthTokenModule,
    BasicAuthModule,
  ],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService, JwtStrategy, JwtRefreshStrategy, PassportModule],
})
export class AuthModule {}
