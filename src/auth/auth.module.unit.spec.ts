import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { JwtStrategy } from './jwt.strategy';
import { jwtScope } from './config/jwt.scope';
import { auth0Scope } from './auth0/config/auth0.scope';
import { Auth0Controller } from './auth0/auth0.controller';
import { Auth0Service } from './auth0/auth0.service';
import { googleScope } from './google/config/google.scope';
import { GoogleController } from './google/google.controller';
import { GoogleService } from './google/google.service';
import { GoogleStrategy } from './google/google.strategy';
import { AuthTokenService } from './core/auth-token/auth-token.service';
import { User } from '../database/entities/user.entity';

/**
 * Stands in for what `src/app.module.ts` supplies from outside `src/auth/`:
 * the three config scopes and the `User` repository. Global, because that is
 * how `ConfigProviderAbstractModule` and `DatabaseModule` are registered.
 */
@Global()
@Module({
  providers: [
    {
      provide: jwtScope.KEY,
      useValue: {
        secret: 'a-test-secret',
        expiresIn: '7d',
        ignoreExpiration: false,
      },
    },
    {
      provide: googleScope.KEY,
      useValue: {
        enabled: true,
        clientId: 'a-client-id',
        clientSecret: 'a-client-secret',
        audience: 'an-audience',
        callbackUrl: 'http://localhost:5000/auth/google/callback',
        selfUrl: 'http://localhost:5000',
      },
    },
    {
      provide: auth0Scope.KEY,
      useValue: {
        enabled: true,
        domain: 'tenant.eu.auth0.com',
        audience: 'https://api.example.com',
        issuer: 'https://tenant.eu.auth0.com/',
      },
    },
    { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
  ],
  exports: [
    jwtScope.KEY,
    googleScope.KEY,
    auth0Scope.KEY,
    getRepositoryToken(User),
  ],
})
class AppContextStubModule {}

/**
 * The same context with both providers switched off — and with their
 * credentials absent, which is what `enabled: false` actually looks like
 * once `google.scope.ts` and `auth0.scope.ts` stop requiring them.
 */
@Global()
@Module({
  providers: [
    {
      provide: jwtScope.KEY,
      useValue: {
        secret: 'a-test-secret',
        expiresIn: '7d',
        ignoreExpiration: false,
      },
    },
    {
      provide: googleScope.KEY,
      useValue: {
        enabled: false,
        callbackUrl: 'http://localhost:5000/auth/google/callback',
        selfUrl: 'http://localhost:5000',
      },
    },
    { provide: auth0Scope.KEY, useValue: { enabled: false } },
    { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
  ],
  exports: [
    jwtScope.KEY,
    googleScope.KEY,
    auth0Scope.KEY,
    getRepositoryToken(User),
  ],
})
class DisabledProvidersContextStubModule {}

describe('AuthModule', () => {
  // `AuthModule` is pure wiring: it holds no logic to unit test, and the only
  // way it can be wrong is by failing to resolve. So this compiles the real
  // graph — the JWT strategy, both providers and the token service the two of
  // them share.
  describe('resolved through a real Nest container', () => {
    it('resolves the JWT strategy and every provider it wires in', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppContextStubModule, AuthModule],
      }).compile();

      expect(moduleRef.get(JwtStrategy)).toBeInstanceOf(JwtStrategy);
      expect(moduleRef.get(GoogleStrategy)).toBeInstanceOf(GoogleStrategy);
      expect(moduleRef.get(GoogleService)).toBeInstanceOf(GoogleService);
      expect(moduleRef.get(Auth0Service)).toBeInstanceOf(Auth0Service);
      expect(moduleRef.get(AuthTokenService)).toBeInstanceOf(AuthTokenService);

      await moduleRef.close();
    });

    // Importing AuthModule is what puts /auth/google and /auth/auth0 on the
    // application — the controllers come in with the provider modules, not
    // from anything AuthModule declares itself.
    it('brings both provider controllers in with it', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppContextStubModule, AuthModule],
      }).compile();

      expect(moduleRef.get(GoogleController)).toBeInstanceOf(GoogleController);
      expect(moduleRef.get(Auth0Controller)).toBeInstanceOf(Auth0Controller);

      await moduleRef.close();
    });
  });

  // Turning a provider off must not cost the application its own auth. The
  // JWT half of this module is what every business route depends on through
  // `AuthGuard('jwt')`, and it has nothing to do with Google or Auth0.
  describe('with both providers disabled', () => {
    it('still compiles, with no provider credentials configured', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [DisabledProvidersContextStubModule, AuthModule],
      }).compile();

      expect(moduleRef.get(JwtStrategy)).toBeInstanceOf(JwtStrategy);
      expect(moduleRef.get(AuthTokenService)).toBeInstanceOf(AuthTokenService);

      await moduleRef.close();
    });

    // `enabled: false` really does keep the Google strategy from being
    // built — see `google/google.module.unit.spec.ts` for the detail.
    it('leaves the Google Passport strategy unbuilt', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [DisabledProvidersContextStubModule, AuthModule],
      }).compile();

      expect(moduleRef.get(GoogleStrategy)).toBeNull();

      await moduleRef.close();
    });
  });

  // What a consuming module gets by importing `AuthModule`: the strategy is
  // registered and `PassportModule` is re-exported, which is what makes
  // `AuthGuard('jwt')` usable outside this module without importing passport
  // a second time.
  describe('public surface', () => {
    it('exports the JWT strategy and PassportModule', () => {
      expect(Reflect.getMetadata('exports', AuthModule)).toEqual([
        JwtStrategy,
        PassportModule,
      ]);
    });

    it('registers jwt as the default passport strategy', () => {
      const imports = Reflect.getMetadata('imports', AuthModule) as Array<{
        module?: unknown;
      }>;

      expect(imports[0].module).toBe(PassportModule);
    });
  });
});
