import { Global, Module, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Auth0Module } from './auth0.module';
import { auth0Scope, Auth0ScopeConfig } from './config/auth0.scope';
import { Auth0Controller } from './auth0.controller';
import { Auth0Service } from './auth0.service';
import { User } from '../../database/entities/user.entity';
import { jwtScope } from '../config/jwt.scope';
import { NestLoggerAdapter } from '../../common/observability/logger/nest-adapter/nest-logger.adapter';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { LogInput } from '../../common/observability/logger/abstract/logger.interfaces';

class RecordingLogger extends LoggerService {
  readonly warnings: LogInput[] = [];
  readonly errors: LogInput[] = [];
  context = '';
  setContext(context: string): void {
    this.context = context;
  }

  log(): void {}
  warn(input: LogInput): void {
    this.warnings.push(input);
  }

  error(input: LogInput): void {
    this.errors.push(input);
  }

  debug(): void {}
}

const config = (enabled: boolean): Auth0ScopeConfig => ({
  enabled,
  domain: 'example.auth0.com',
  audience: 'an-audience',
  issuer: 'https://example.auth0.com/',
});

/**
 * What a disabled provider's scope really looks like: `enabled: false` makes
 * `domain` and `audience` optional in `auth0.scope.ts`, so they are absent.
 */
const configWithoutCredentials = (): Auth0ScopeConfig =>
  ({ enabled: false }) as Auth0ScopeConfig;

/**
 * Stands in for what `src/app.module.ts` and `DatabaseModule` supply from
 * outside `src/auth/auth0/`: the config scopes (`AuthTokenModule` needs the
 * JWT one) and the `User` repository.
 */
const contextModule = (auth0Conf: Auth0ScopeConfig): Type<unknown> => {
  @Global()
  @Module({
    providers: [
      { provide: auth0Scope.KEY, useValue: auth0Conf },
      {
        provide: jwtScope.KEY,
        useValue: {
          secret: 'a-test-secret',
          expiresIn: '7d',
          ignoreExpiration: false,
        },
      },
      { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
    ],
    exports: [auth0Scope.KEY, jwtScope.KEY, getRepositoryToken(User)],
  })
  class Auth0ContextStubModule {}

  return Auth0ContextStubModule;
};

describe('Auth0Module', () => {
  let logger: RecordingLogger;

  beforeEach(() => {
    logger = new RecordingLogger();
  });

  describe('compiled with the provider disabled', () => {
    // Auth0 has no Passport strategy to skip — nothing it builds needs a
    // credential at construction time. What makes the flag real here is
    // `Auth0EnabledGuard`, which 404s the route; see
    // `auth0-enabled.guard.unit.spec.ts`.
    it('compiles with no domain or audience configured', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [contextModule(configWithoutCredentials()), Auth0Module],
      }).compile();

      expect(moduleRef.get(Auth0Service)).toBeInstanceOf(Auth0Service);

      await moduleRef.close();
    });
  });

  // The behaviour a caller sees. Nest maps the route either way — the flag
  // is only readable after the container has resolved the scope, which is
  // after the route is mapped — so `Auth0EnabledGuard` turns it into a 404
  // instead of a 401 from a provider call that was never going to work.
  describe('mounted on an HTTP application with the provider disabled', () => {
    it('answers 404 on POST /auth/auth0/login', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [contextModule(configWithoutCredentials()), Auth0Module],
      }).compile();
      const app = moduleRef.createNestApplication();
      await app.init();

      await request(app.getHttpServer())
        .post('/auth/auth0/login')
        .send({ accessToken: 'an-access-token' })
        .expect(404);

      await app.close();
    });
  });

  describe('compiled with the provider enabled', () => {
    it('registers the controller and the service', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [contextModule(config(true)), Auth0Module],
      }).compile();

      expect(moduleRef.get(Auth0Controller)).toBeInstanceOf(Auth0Controller);
      expect(moduleRef.get(Auth0Service)).toBeInstanceOf(Auth0Service);

      await moduleRef.close();
    });
  });

  describe('mounted on an HTTP application with the provider enabled', () => {
    // Unchanged behaviour: the request reaches `Auth0Service`, which rejects
    // the token — a 401, not the guard's 404.
    it('reaches the service on POST /auth/auth0/login', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 401 });
      const originalFetch = global.fetch;
      global.fetch = fetchMock as unknown as typeof global.fetch;

      const moduleRef = await Test.createTestingModule({
        imports: [contextModule(config(true)), Auth0Module],
      }).compile();
      const app = moduleRef.createNestApplication();
      await app.init();

      await request(app.getHttpServer())
        .post('/auth/auth0/login')
        .send({ accessToken: 'an-access-token' })
        .expect(401);

      expect(fetchMock).toHaveBeenCalledTimes(1);

      await app.close();
      global.fetch = originalFetch;
    });
  });

  // The route cannot be unmapped from here — the flag is only readable after
  // the container has resolved the scope, which is after Nest has mapped it
  // (`Auth0EnabledGuard` 404s it instead). The constructor line is what says
  // so; it must not claim anything more than that.
  describe('the disabled-provider notice', () => {
    it('warns that the route is still mapped', () => {
      new Auth0Module(config(false), logger);

      expect(logger.warnings).toHaveLength(1);
      expect(logger.warnings[0].message).toMatch(/404/);
      expect(logger.warnings[0].message).toMatch(/remove auth0module/i);
      expect(logger.context).toBe('Auth0Module');
    });

    // It is a supported configuration, not a misconfiguration.
    it('does not log it as an error', () => {
      new Auth0Module(config(false), logger);

      expect(logger.errors).toHaveLength(0);
    });

    it('stays quiet when the provider is enabled', () => {
      new Auth0Module(config(true), logger);

      expect(logger.warnings).toHaveLength(0);
    });

    // The logger is @Optional() so `src/auth/` lifts into a project that has
    // not registered LoggerAbstractModule; the notice still has to come out.
    it('still warns when no logger is injected', () => {
      const fallback = jest
        .spyOn(NestLoggerAdapter.prototype, 'warn')
        .mockImplementation();

      new Auth0Module(configWithoutCredentials());

      expect(fallback).toHaveBeenCalledTimes(1);
      fallback.mockRestore();
    });
  });
});
