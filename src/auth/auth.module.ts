import { Module } from '@nestjs/common';
import { GoogleModule } from './google/google.module';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/user/user.model';
import { AuthTokenModule } from './core/auth-token/auth-token.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // GoogleModule,
    TypeOrmModule.forFeature([User]),
    AuthTokenModule,
    EmailModule,
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
