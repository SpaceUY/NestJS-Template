import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './common/database/database.module';
import { ConfigModule } from './config/config.module';
import { MiddlewareModule } from './common/middleware/middleware.module';
import { TemplateModule } from './template/template.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    MiddlewareModule,
    TemplateModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
