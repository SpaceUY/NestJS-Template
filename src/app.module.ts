import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appScope } from './app.scope';
import { AuthModule } from './auth/auth.module';
import { jwtScope } from './auth/config/jwt.scope';
import { googleScope } from './auth/google/config/google.scope';
import { auth0Scope } from './auth/auth0/config/auth0.scope';
import { MiddlewareModule } from './common/middleware/middleware.module';
import { CloudStorageAbstractModule } from './cloud-storage/abstract/cloud-storage-abstract.module';
import { S3AdapterService } from './cloud-storage/s3-adapter/s3-adapter.service';
import {
  s3Scope,
  S3ScopeConfig,
} from './cloud-storage/s3-adapter/config/s3.scope';
import { ConfigProviderAbstractModule } from './config-provider/abstract/config-provider-abstract.module';
import { EnvConfigAdapter } from './config-provider/env-adapter/env-config.adapter';
import { EmailAbstractModule } from './email/abstract/email-abstract.module';
import {
  emailScope,
  EMAIL_ADAPTERS,
  EmailScopeConfig,
} from './email/config/email.scope';
import { DatabaseModule } from './database/database.module';
import { databaseScope } from './database/config/database.scope';
import { PushNotificationAbstractModule } from './push-notification/abstract/push-notification-abstract.module.ts';
import { ExpoAdapterModule } from './push-notification/expo-adapter/expo-adapter.module';
import {
  expoScope,
  ExpoScopeConfig,
} from './push-notification/expo-adapter/config/expo.scope';
import { TemplateModule } from './templating/template.module';
import { PugAdapterModule } from './templating/pug-adapter/pug-adapter.module';
import { ConsoleAdapterService } from './email/console-adapter/console-adapter.service';
import { AwsSesAdapterService } from './email/aws-ses-adapter/aws-ses-adapter.service';
import { SendgridAdapterService } from './email/sendgrid-adapter/sendgrid-adapter.service';
import { ResendAdapterService } from './email/resend-adapter/resend-adapter.service';
import { LoggerAbstractModule } from './common/observability/logger/abstract/logger-abstract.module';
import { LoggerService } from './common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from './common/observability/logger/nest-adapter/nest-logger.adapter';
import { TraceContextLoggerDecorator } from './common/observability/logger/trace-context/trace-context-logger.decorator';
import { trace } from '@opentelemetry/api';
import {
  analyticsScope,
  AnalyticsScopeConfig,
  ANALYTICS_ADAPTERS,
} from './common/observability/analytics/config/analytics.scope';
import { AnalyticsAbstractModule } from './common/observability/analytics/abstract/analytics-abstract.module';
import { PosthogAdapterService } from './common/observability/analytics/posthog-adapter/posthog-adapter.service';
import { ConsoleAdapterService as AnalyticsConsoleAdapterService } from './common/observability/analytics/console-adapter/console-adapter.service';
import { QueueProducerModule } from './queues/abstract/producer/queue-producer.module';
import { QueueConsumerModule } from './queues/abstract/consumer/queue-consumer.module';
import { BullMqProducerAdapter } from './queues/bullmq-adapter/bullmq-producer.adapter';
import { BullMqConsumerAdapter } from './queues/bullmq-adapter/bullmq-consumer.adapter';
import { redisScope, RedisScopeConfig } from './redis.scope';
import { rabbitmqScope } from './queues/rabbitmq-adapter/config/rabbitmq.scope';
import { CacheAbstractModule } from './cache/abstract/cache-abstract.module';
import { RedisCacheAdapterService } from './cache/redis-adapter/redis-adapter.service';
@Module({
  imports: [
    ConfigProviderAbstractModule.forRootAsync({
      isGlobal: true,
      sources: {
        env: {
          useFactory: () => new EnvConfigAdapter({ envFilePath: '.env' }),
        },
      },
      scopes: [
        appScope,
        jwtScope,
        googleScope,
        auth0Scope,
        s3Scope,
        emailScope,
        expoScope,
        databaseScope,
        analyticsScope,
        redisScope,
        rabbitmqScope,
      ],
    }),
    AuthModule,
    MiddlewareModule,
    QueueProducerModule.forRootAsync({
      isGlobal: true,
      inject: [redisScope.KEY],
      useFactory: (redis: RedisScopeConfig) =>
        new BullMqProducerAdapter({
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password || undefined,
          },
        }),
    }),
    QueueConsumerModule.forRootAsync({
      isGlobal: true,
      inject: [redisScope.KEY],
      useFactory: (redis: RedisScopeConfig) =>
        new BullMqConsumerAdapter({
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password || undefined,
          },
        }),
    }),
    CacheAbstractModule.forRootAsync({
      isGlobal: true,
      inject: [redisScope.KEY],
      useFactory: (redis: RedisScopeConfig) =>
        new RedisCacheAdapterService({
          protocol: 'redis',
          host: redis.host,
          port: redis.port,
          password: redis.password || undefined,
        }),
    }),
    DatabaseModule,
    LoggerAbstractModule.forRootAsync({
      isGlobal: true,
      useFactory: () =>
        new TraceContextLoggerDecorator(new NestLoggerAdapter()),
      telemetryHook: (level, input, context) => {
        trace.getActiveSpan()?.addEvent(input.message, {
          level,
          context,
          ...input.data,
        });
      },
    }),
    TemplateModule.forRoot({
      adapter: PugAdapterModule.register({}),
      isGlobal: true,
    }),
    EmailAbstractModule.forRootAsync({
      // No LoggerService here: EmailAbstractModule injects it itself (optionally)
      // and calls setLogger() on whatever adapter this factory returns.
      inject: [emailScope.KEY],
      useFactory: (email: EmailScopeConfig) => {
        const configuredAdapter = email.adapter?.toUpperCase();

        if (configuredAdapter === EMAIL_ADAPTERS.SENDGRID) {
          return new SendgridAdapterService({
            sendgridApiKey: email.sendgridApiKey,
            emailFrom: email.from,
          });
        }

        if (configuredAdapter === EMAIL_ADAPTERS.RESEND) {
          return new ResendAdapterService({
            resendApiKey: email.resendApiKey,
            emailFrom: email.resendEmailFrom || email.from,
          });
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
    AnalyticsAbstractModule.forRootAsync({
      inject: [analyticsScope.KEY, LoggerService],
      useFactory: (analytics: AnalyticsScopeConfig, logger: LoggerService) =>
        analytics.adapter === ANALYTICS_ADAPTERS.POSTHOG
          ? new PosthogAdapterService(
              {
                apiKey: analytics.posthogApiKey,
                host: analytics.posthogHost,
              },
              logger,
            )
          : new AnalyticsConsoleAdapterService(logger),
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
