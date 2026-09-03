import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GoogleModule } from './google/google.module';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AuthTokenModule } from './core/auth-token/auth-token.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    GoogleModule,
    AuthTokenModule,
    EmailModule,
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
