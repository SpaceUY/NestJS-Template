import { Module } from '@nestjs/common';
import { EmailCoreModule } from './core/email-core.module';
import testEmail from './emails/test.email';
import test2Email from './emails/test2.email';

@Module({
  imports: [EmailCoreModule.forRoot([testEmail, test2Email])],
  exports: [EmailCoreModule],
})
export class EmailModule {}
