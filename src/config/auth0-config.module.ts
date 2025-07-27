import { Module } from '@nestjs/common';
import { Auth0ConfigService } from './auth0-config.service';

@Module({
  providers: [Auth0ConfigService],
  exports: [Auth0ConfigService],
})
export class Auth0ConfigModule {}
