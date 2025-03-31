import { Module } from '@nestjs/common';
import { BasicAuthController } from './basic-auth.controller';
import { BasicAuthService } from './basic-auth.service';
import { AuthTokenModule } from '../core/auth-token/auth-token.module';

@Module({
  imports: [AuthTokenModule],
  controllers: [BasicAuthController],
  providers: [BasicAuthService],
})
export class BasicAuthModule {}
