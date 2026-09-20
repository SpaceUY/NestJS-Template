import './common/observability/telemetry/tracing.bootstrap';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { appScope, AppScopeConfig } from './app.scope';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const appConf = app.get<AppScopeConfig>(appScope.KEY);
  app.enableShutdownHooks();
  app.enableCors({
    // Comes from CORS_ORIGINS; required, and never a wildcard, when
    // NODE_ENV=PROD. See src/app.scope.ts.
    origin: appConf.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'origin',
      'authorization',
      'content-type',
      'x-requested-with',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, forbidNonWhitelisted: true }),
  );

  const config = new DocumentBuilder()
    .setTitle('NestJS Template')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(appConf.port);
}
bootstrap();
