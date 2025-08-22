import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Auth0JwtStrategy } from './auth0-jwt.strategy';
import { Auth0Guard } from './auth0.guard';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'auth0-jwt' }),
    PrismaModule,
  ],
  providers: [AuthService, Auth0JwtStrategy, Auth0Guard],
  exports: [AuthService, Auth0JwtStrategy, Auth0Guard, PassportModule],
})
export class AuthModule {}
