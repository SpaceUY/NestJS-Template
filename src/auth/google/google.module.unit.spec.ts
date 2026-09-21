import { Global, Module, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoogleModule } from './google.module';
import { googleScope, GoogleScopeConfig } from './config/google.scope';
import { GoogleController } from './google.controller';
import { GoogleStrategy } from './google.strategy';
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

const config = (enabled: boolean): GoogleScopeConfig => ({
  enabled,
  clientId: 'a-client-id',
  clientSecret: 'a-client-secret',
  audience: 'an-audience',
  callbackUrl: 'http://localhost:3000/auth/google/callback',
  selfUrl: 'http://localhost:3000',
});

/**
 * What a disabled provider's scope really looks like: `enabled: false` makes
 * every credential optional in `google.scope.ts`, so they are simply absent.
 * Building the module with this is the case that used to crash the process
 * with `OAuth2Strategy requires a clientID option`.
 */
const configWithoutCredentials = (): GoogleScopeConfig =>
  ({
    enabled: false,
    selfUrl: 'http://localhost:3000',
    callbackUrl: 'http://localhost:3000/auth/google/callback',
  }) as GoogleScopeConfig;

/**
 * Stands in for what `src/app.module.ts` and `DatabaseModule` supply from
 * outside `src/auth/google/`: the config scopes (`AuthTokenModule` needs the
 * JWT one) and the `User` repository.
 */
const contextModule = (googleConf: GoogleScopeConfig): Type<unknown> => {
  @Global()
  @Module({
    providers: [
      { provide: googleScope.KEY, useValue: googleConf },
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
    exports: [googleScope.KEY, jwtScope.KEY, getRepositoryToken(User)],
  })
  class GoogleContextStubModule {}

  return GoogleContextStubModule;
};

// `@nestjs/passport` registers a strategy on the process-wide passport
// singleton from the strategy's constructor, so "was the strategy
// instantiated" and "is 'google' registered with passport" are the same
// question — and the registry has to be cleaned between tests. Reached
// through `requireActual` because `passport` ships no types and this
// template has no `@types/passport`.
interface PassportRegistry {
  _strategies: Record<string, unknown>;
}

const passportStrategies = (): Record<string, unknown> =>
  (jest.requireActual('passport') as PassportRegistry)._strategies;

describe('GoogleModule', () => {
  let logger: RecordingLogger;

  beforeEach(() => {
    logger = new RecordingLogger();
    delete passportStrategies().google;
  });

  afterEach(() => {
    delete passportStrategies().google;
  });

  describe('compiled with the provider disabled', () => {
    it('does not instantiate the Passport strategy', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [contextModule(config(false)), GoogleModule],
      }).compile();

      expect(moduleRef.get(GoogleStrategy)).toBeNull();
      expect(passportStrategies().google).toBeUndefined();

      await moduleRef.close();
    });

    // The regression this module exists to prevent: with
    // `GOOGLE_OAUTH_ENABLED=false` the credentials are legitimately missing,
    // and the application has to start anyway.
    it('compiles with no credentials configured at all', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [contextModule(configWithoutCredentials()), GoogleModule],
      }).compile();

      expect(moduleRef.get(GoogleStrategy)).toBeNull();

      await moduleRef.close();
    });
  });

  // The behaviour a caller sees. Nest maps the controller's routes either
  // way — the flag is only readable after the container has resolved the
  // scope, which is after the routes are mapped — so `GoogleEnabledGuard`
  // turns them into 404s. Without it they reach `AuthGuard('google')` and
  // 500 on a strategy that was never registered.
  describe('mounted on an HTTP application with the provider disabled', () => {
    it('answers 404 on every /auth/google route', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [contextModule(configWithoutCredentials()), GoogleModule],
      }).compile();
      const app = moduleRef.createNestApplication();
      await app.init();

      const server = app.getHttpServer();
      await request(server).get('/auth/google/web').expect(404);
      await request(server).get('/auth/google/callback').expect(404);
      await request(server)
        .post('/auth/google/mobile/register')
        .send({ idToken: 'an-id-token' })
        .expect(404);
      await request(server)
        .post('/auth/google/mobile/login')
        .send({ idToken: 'an-id-token' })
        .expect(404);

      await app.close();
    });
  });

  describe('compiled with the provider enabled', () => {
    it('instantiates the Passport strategy and registers it as "google"', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [contextModule(config(true)), GoogleModule],
      }).compile();

      expect(moduleRef.get(GoogleStrategy)).toBeInstanceOf(GoogleStrategy);
      expect(passportStrategies().google).toBeDefined();

      await moduleRef.close();
    });

    // Unchanged behaviour: the handshake still starts, which is only
    // possible because the strategy is registered with passport.
    it('starts the OAuth handshake on GET /auth/google/web', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [contextModule(config(true)), GoogleModule],
      }).compile();
      const app = moduleRef.createNestApplication();
      await app.init();

      const response = await request(app.getHttpServer())
        .get('/auth/google/web')
        .expect(302);

      expect(response.headers.location).toContain('accounts.google.com');

      await app.close();
    });

    it('registers the controller', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [contextModule(config(true)), GoogleModule],
      }).compile();

      expect(moduleRef.get(GoogleController)).toBeInstanceOf(GoogleController);

      await moduleRef.close();
    });
  });

  // The routes cannot be unmapped from here — the flag is only readable after
  // the container has resolved the scope, which is after Nest has mapped
  // them (`GoogleEnabledGuard` 404s them instead). The constructor line is
  // what says so; it must not claim anything more than that.
  describe('the disabled-provider notice', () => {
    it('warns that the routes are still mapped', () => {
      new GoogleModule(config(false), logger);

      expect(logger.warnings).toHaveLength(1);
      expect(logger.warnings[0].message).toMatch(/404/);
      expect(logger.warnings[0].message).toMatch(/remove googlemodule/i);
      expect(logger.context).toBe('GoogleModule');
    });

    // It is a supported configuration, not a misconfiguration: nothing here
    // is an error any more.
    it('does not log it as an error', () => {
      new GoogleModule(config(false), logger);

      expect(logger.errors).toHaveLength(0);
    });

    it('stays quiet when the provider is enabled', () => {
      new GoogleModule(config(true), logger);

      expect(logger.warnings).toHaveLength(0);
    });

    // Root rule 4: the client secret is a credential and never reaches a log.
    it('never writes the client secret into the notice', () => {
      new GoogleModule(config(false), logger);

      expect(JSON.stringify(logger.warnings)).not.toContain('a-client-secret');
    });

    // The logger is @Optional() so `src/auth/` lifts into a project that has
    // not registered LoggerAbstractModule; the notice still has to come out.
    it('still warns when no logger is injected', () => {
      const fallback = jest
        .spyOn(NestLoggerAdapter.prototype, 'warn')
        .mockImplementation();

      new GoogleModule(configWithoutCredentials());

      expect(fallback).toHaveBeenCalledTimes(1);
      fallback.mockRestore();
    });
  });
});
