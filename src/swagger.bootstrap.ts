import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppScopeConfig } from './app.scope';

/**
 * Where the UI and the generated document are mounted. Exported because the
 * path is also what a Content-Security-Policy has to keep working — see the
 * helmet block in `src/main.ts`.
 */
export const SWAGGER_PATH = 'api';

/**
 * Mounts Swagger when the configuration allows it.
 *
 * The gate is `SWAGGER_ENABLED`, which defaults to off under `NODE_ENV=PROD`
 * and on everywhere else; the reasoning for a flag rather than a bare
 * environment check lives next to the field in `src/app.scope.ts`.
 *
 * Everything sits behind the gate on purpose. Scanning the whole application
 * to build the document costs startup time and memory, and a production
 * process should not pay for a page it never serves — so the `DocumentBuilder`
 * is not constructed either.
 *
 * Lives outside `src/main.ts` so the decision is reachable from a test:
 * `main.ts` calls `bootstrap()` at import time and cannot be imported.
 *
 * @param app The application to mount on.
 * @param appConf The resolved app scope.
 * @returns Whether Swagger was mounted.
 */
export function setupSwagger(
  app: INestApplication,
  appConf: AppScopeConfig,
): boolean {
  if (!appConf.swaggerEnabled) return false;

  const config = new DocumentBuilder()
    .setTitle('NestJS Template')
    .addBearerAuth()
    .build();

  SwaggerModule.setup(
    SWAGGER_PATH,
    app,
    SwaggerModule.createDocument(app, config),
  );

  return true;
}
