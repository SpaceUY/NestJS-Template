import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appScope } from './app.scope';
import { AuthModule } from './auth/auth.module';
import { jwtScope } from './auth/config/jwt.scope';
import { googleScope } from './auth/google/config/google.scope';
import { MiddlewareModule } from './common/middleware/middleware.module';
import { CloudStorageAbstractModule } from './cloud-storage/abstract/cloud-storage-abstract.module';
import { S3AdapterService } from './cloud-storage/s3-adapter/s3-adapter.service';
import { s3Scope, S3ScopeConfig } from './cloud-storage/s3-adapter/config/s3.scope';
import { ConfigProviderAbstractModule } from './config-provider/abstract/config-provider-abstract.module';
import { EnvConfigAdapter } from './config-provider/env-adapter/env-config.adapter';
import { EmailAbstractModule } from './email/abstract/email-abstract.module';
import { emailScope, EmailScopeConfig, EMAIL_ADAPTERS } from './email/config/email.scope';
import { AwsSesAdapterService } from './email/aws-ses-adapter/aws-ses-adapter.service';
import { ConsoleAdapterService } from './email/console-adapter/console-adapter.service';
import { ResendAdapterService } from './email/resend-adapter/resend-adapter.service';
import { SendgridAdapterService } from './email/sendgrid-adapter/sendgrid-adapter.service';
import { createDefaultEmailLogger } from './email/utils/email-logger.adapter';
import { DatabaseModule } from './database/database.module';
import { PushNotificationAbstractModule } from './push-notification/abstract/push-notification-abstract.module.ts';
import { ExpoAdapterModule } from './push-notification/expo-adapter/expo-adapter.module';
import { expoScope, ExpoScopeConfig } from './push-notification/expo-adapter/config/expo.scope';
import { SpaceshipModule } from './spaceship/spaceship.module';
import { TemplateModule } from './templating/template.module';
import { PugAdapterModule } from './templating/pug-adapter/pug-adapter.module';

@Module({
  imports: [
    ConfigProviderAbstractModule.forRootAsync({
      isGlobal: true,
      sources: {
        env: {
          useFactory: () => new EnvConfigAdapter(),
        },
      },
      scopes: [appScope, jwtScope, googleScope, s3Scope, emailScope, expoScope],
    }),
    AuthModule,
    MiddlewareModule,
    SpaceshipModule,
    DatabaseModule,
    TemplateModule.forRoot({
      adapter: PugAdapterModule.register({}),
      isGlobal: true,
    }),
    EmailAbstractModule.forRootAsync({
      inject: [emailScope.KEY],
      useFactory: (email: EmailScopeConfig) => {
        const logger = createDefaultEmailLogger();
        const configuredAdapter = email.adapter?.toUpperCase();

        if (configuredAdapter === EMAIL_ADAPTERS.SENDGRID) {
          return new SendgridAdapterService(
            { sendgridApiKey: email.sendgridApiKey, emailFrom: email.from },
            logger,
          );
        }

        if (configuredAdapter === EMAIL_ADAPTERS.RESEND) {
          return new ResendAdapterService(
            {
              resendApiKey: email.resendApiKey,
              emailFrom: email.resendEmailFrom || email.from,
            },
            logger,
          );
        }

        if (configuredAdapter === EMAIL_ADAPTERS.AWS_SES) {
          return new AwsSesAdapterService({
            region: email.sesRegion,
            accessKeyId: email.sesAccessKeyId,
            secretAccessKey: email.sesSecretAccessKey,
            fromEmail: email.from,
          });
        }

        return new ConsoleAdapterService({ fromEmail: email.from });
      },
      isGlobal: true,
    }),
    CloudStorageAbstractModule.forRootAsync({
      inject: [s3Scope.KEY],
      useFactory: (s3: S3ScopeConfig) =>
        new S3AdapterService({
          bucket: s3.bucket,
          region: s3.region,
          accessKeyId: s3.accessKeyId,
          secretAccessKey: s3.secretAccessKey,
          expiresInSeconds: s3.expiresInSeconds,
        }),
      useDefaultController: true,
      isGlobal: true,
    }),
    PushNotificationAbstractModule.forRoot({
      adapter: ExpoAdapterModule.registerAsync({
        inject: [expoScope.KEY],
        useFactory: (expo: ExpoScopeConfig) => ({
          expoAccessToken: expo.accessToken,
        }),
      }),
      useDefaultController: true,
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
