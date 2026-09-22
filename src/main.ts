import './common/observability/telemetry/tracing.bootstrap';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { appScope, AppScopeConfig } from './app.scope';
import { setupSwagger } from './swagger.bootstrap';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const appConf = app.get<AppScopeConfig>(appScope.KEY);
  app.enableShutdownHooks();

  // Off by default (see src/app.scope.ts). Set TRUST_PROXY to the hop count
  // or address list a real deployment needs — a load balancer in front, or an
  // EC2 instance reachable on its own elastic IP, decide this differently and
  // it must stay a deployment choice, not a hardcoded one. It has to run
  // before anything reads req.ip, which includes the rate limiter.
  app.set('trust proxy', appConf.trustProxy);

  // First in the middleware stack, so every response carries the headers —
  // including the Swagger page mounted further down.
  //
  // The defaults are used as they come, which is a checked decision rather
  // than a shortcut: the received wisdom that helmet's CSP breaks Swagger
  // predates the UI @nestjs/swagger 11 serves. That page loads three
  // same-origin scripts (`swagger-ui-bundle.js`, `swagger-ui-standalone-preset.js`,
  // `swagger-ui-init.js` — the initializer is a served file, not an inline
  // tag), one same-origin stylesheet, two same-origin favicons and two inline
  // `<style>` blocks, and carries no inline `<script>` and no `on*`
  // attributes. `script-src 'self'` and `img-src 'self' data:` cover the
  // first group, and helmet's `style-src` already includes `'unsafe-inline'`,
  // which is what the two `<style>` blocks need. The CSS references only
  // `data:` URLs, covered by `img-src`/`font-src`. Nothing needs relaxing, so
  // nothing is relaxed — weakening a directive the UI does not need would be
  // the opposite of the point.
  //
  // `src/swagger.bootstrap.unit.spec.ts` holds that claim in place: it boots
  // an app with these defaults and fails if the page ever references
  // something the emitted policy does not allow.
  //
  // Two consequences to know about. `connect-src` falls back to
  // `default-src 'self'`, so "Try it out" reaches this API and no other — add
  // the host to `connect-src` if the document ever grows a `.addServer()`
  // pointing elsewhere. And `upgrade-insecure-requests` is on, which is
  // correct behind TLS and is why plain-HTTP staging hosts should still
  // terminate TLS at the load balancer.
  app.use(helmet());

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

  // Gated on SWAGGER_ENABLED, which defaults to off in PROD. Nothing is built
  // when it is off — see src/swagger.bootstrap.ts.
  setupSwagger(app, appConf);

  await app.listen(appConf.port);
}
bootstrap();
