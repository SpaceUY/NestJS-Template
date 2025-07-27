import { Module } from '@nestjs/common';
import { GoogleModule } from './google/google.module';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { Auth0JwtStrategy } from './auth0-jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { AuthTokenModule } from './core/auth-token/auth-token.module';
import { EmailModule } from './email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { Auth0ConfigModule } from '../config/auth0-config.module';
import { UserSyncModule } from './user-sync/user-sync.module';
import {
  Auth0JwtGuard,
  PermissionsGuard,
  RolesGuard,
  Auth0Guard,
} from './guards';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    GoogleModule,
    PrismaModule,
    AuthTokenModule,
    EmailModule,
    Auth0ConfigModule,
    UserSyncModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    Auth0JwtStrategy,
    Auth0JwtGuard,
    PermissionsGuard,
    RolesGuard,
    Auth0Guard,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    Auth0JwtStrategy,
    PassportModule,
    Auth0JwtGuard,
    PermissionsGuard,
    RolesGuard,
    Auth0Guard,
  ],
})
export class AuthModule {}
