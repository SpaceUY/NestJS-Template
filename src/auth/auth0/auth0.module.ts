import { Module } from '@nestjs/common';
import { Auth0Service } from './auth0.service';
import { Auth0ConfigModule } from '../../config/auth0-config.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [Auth0ConfigModule, PrismaModule],
  providers: [Auth0Service],
  exports: [Auth0Service],
})
export class Auth0Module {}
