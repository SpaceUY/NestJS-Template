import { Module } from '@nestjs/common';
import { EmailAuthController } from './email.controller';
import { EmailAuthService } from './email.service';
import { AuthTokenModule } from '../core/auth-token/auth-token.module';

@Module({
  imports: [AuthTokenModule],
  controllers: [EmailAuthController],
  providers: [EmailAuthService],
})
export class EmailModule {}
