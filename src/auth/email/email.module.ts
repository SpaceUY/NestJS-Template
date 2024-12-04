import { Module } from '@nestjs/common';
import { EmailAuthController } from './email.controller';

@Module({
  controllers: [EmailAuthController],
})
export class EmailModule {}
