import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import request from 'supertest';
import { AppScopeConfig } from './app.scope';
import { setupSwagger, SWAGGER_PATH } from './swagger.bootstrap';

const appConf = (overrides: Partial<AppScopeConfig> = {}): AppScopeConfig => ({
  nodeEnv: 'DEV',
  port: 5000,
  selfUrl: 'http://localhost:5000',
  corsOrigins: ['*'],
  swaggerEnabled: true,
  trustProxy: false,
  ...overrides,
});

describe('setupSwagger', () => {
  let createDocument: jest.SpyInstance;
  let setup: jest.SpyInstance;

  beforeEach(() => {
    createDocument = jest
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue({} as OpenAPIObject);
    setup = jest.spyOn(SwaggerModule, 'setup').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const app = {} as INestApplication;

  it('mounts the UI where the flag allows it', () => {
    expect(setupSwagger(app, appConf())).toBe(true);
    expect(setup).toHaveBeenCalledWith(SWAGGER_PATH, app, expect.anything());
  });

  it('publishes nothing when the flag is off', () => {
    expect(setupSwagger(app, appConf({ swaggerEnabled: false }))).toBe(false);
    expect(setup).not.toHaveBeenCalled();
  });

  // Not just unmounted: the document is a full scan of every controller and
  // DTO in the application, and a process that will never serve it should
  // not spend the startup time or hold the result.
  it('does not build the document when the flag is off', () => {
    setupSwagger(app, appConf({ swaggerEnabled: false }));
    expect(createDocument).not.toHaveBeenCalled();
  });

  // The flag is what main.ts reads; that it defaults to off under
  // NODE_ENV=PROD is the app scope's job and is covered in
  // src/app.scope.unit.spec.ts. Here we only prove the two are connected:
  // a PROD configuration resolved with its default publishes nothing.
  it('publishes nothing for a production configuration', () => {
    expect(
      setupSwagger(
        app,
        appConf({
          nodeEnv: 'PROD',
          corsOrigins: ['https://app.io'],
          swaggerEnabled: false,
        }),
      ),
    ).toBe(false);
  });
});

@Controller('things')
class ThingsController {
  @Get()
  list(): { ok: boolean } {
    return { ok: true };
  }
}

/**
 * Parses a Content-Security-Policy header into directive -> values.
 * @param header The raw header value.
 * @returns One entry per directive.
 */
const directivesOf = (header: string): Map<string, string[]> =>
  new Map(
    header
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .map(([name, ...values]): [string, string[]] => [name, values]),
  );

/**
 * The claim `src/main.ts` makes when it mounts `helmet()` with no overrides:
 * helmet's default Content-Security-Policy already allows everything the
 * Swagger UI that @nestjs/swagger 11 serves needs. That is only true because
 * the page loads same-origin assets and its initializer is a served file
 * rather than an inline tag — both of which a dependency upgrade could
 * change without warning, on either side.
 *
 * So this boots the same pair and fails the day the page starts asking for
 * something the emitted policy does not cover, instead of leaving it to be
 * discovered as a blank page in staging.
 */
describe('Swagger UI under helmet defaults', () => {
  let app: INestApplication;
  let html: string;
  let csp: Map<string, string[]>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThingsController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(helmet());
    setupSwagger(app, appConf());
    await app.init();

    const res = await request(app.getHttpServer()).get(`/${SWAGGER_PATH}`);
    expect(res.status).toBe(200);
    html = res.text;
    csp = directivesOf(res.headers['content-security-policy']);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the page with a policy at all', () => {
    expect(csp.get('default-src')).toEqual(["'self'"]);
  });

  it('loads every script from this origin, which script-src allows', () => {
    const sources = [...html.matchAll(/<script[^>]*src=["']([^"']+)["']/g)].map(
      (match) => match[1],
    );

    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.startsWith(`./${SWAGGER_PATH}/`)).toBe(true);
    }
    expect(csp.get('script-src')).toContain("'self'");
  });

  it('carries no inline script for script-src to block', () => {
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)/);
    expect(html).not.toMatch(/\son[a-z]+=/);
  });

  // The one directive the page genuinely depends on: its <style> blocks are
  // inline. Tightening style-src is what would break the UI.
  it('relies on the inline styles style-src still permits', () => {
    expect(html).toMatch(/<style/);
    expect(csp.get('style-src')).toContain("'unsafe-inline'");
  });

  it('loads every stylesheet and icon from this origin', () => {
    const hrefs = [...html.matchAll(/<link[^>]*href=["']([^"']+)["']/g)].map(
      (match) => match[1],
    );

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith(`./${SWAGGER_PATH}/`)).toBe(true);
    }
    expect(csp.get('img-src')).toEqual(["'self'", 'data:']);
  });

  it('actually serves each asset the page references', async () => {
    for (const asset of [
      'swagger-ui.css',
      'swagger-ui-bundle.js',
      'swagger-ui-standalone-preset.js',
      'swagger-ui-init.js',
      'favicon-32x32.png',
    ]) {
      const res = await request(app.getHttpServer()).get(
        `/${SWAGGER_PATH}/${asset}`,
      );
      expect([asset, res.status]).toEqual([asset, 200]);
    }
  });

  // The stylesheet's only external references are data: URLs, which img-src
  // and font-src both allow. An http(s) URL appearing here would need a
  // directive the defaults do not grant.
  it('serves a stylesheet that references nothing off-origin', async () => {
    const res = await request(app.getHttpServer()).get(
      `/${SWAGGER_PATH}/swagger-ui.css`,
    );
    const schemes = new Set(
      [...res.text.matchAll(/url\(["']?([a-z]+:)?/g)].map(
        (match) => match[1] ?? 'relative',
      ),
    );

    expect([...schemes]).toEqual(['data:']);
    expect(csp.get('font-src')).toContain('data:');
  });
});
