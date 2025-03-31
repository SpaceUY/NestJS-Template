import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { MiddlewareModule } from './common/middleware/middleware.module';
import { TemplateModule } from './template/template.module';
import { EmailModule } from './email/sendgrid/email.module';
import { SpaceshipModule } from './spaceship/spaceship.module';
import { PrismaModule } from './prisma/prisma.module';
import { S3AdapterModule } from './cloud-storage/s3-adapter/s3-adapter.module';
import { CloudStorageAbstractModule } from './cloud-storage/abstract/cloud-storage-abstract.module.ts';
import { ConfigType } from '@nestjs/config';
import awsConfig from 'src/config/aws.config';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    MiddlewareModule,
    TemplateModule,
    EmailModule,
    SpaceshipModule,
    PrismaModule,
    S3AdapterModule,
    CloudStorageAbstractModule.forRoot({
      adapter: S3AdapterModule.forRootAsync({
        inject: [awsConfig.KEY],
        useFactory: (aws: ConfigType<typeof awsConfig>) => ({
          bucket: aws.s3.bucket,
          region: aws.base.region,
          accessKeyId: aws.base.accessKeyId,
          secretAccessKey: aws.base.secretAccessKey,
          expiresInSeconds: aws.s3.expiresInSeconds,
        }),
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
