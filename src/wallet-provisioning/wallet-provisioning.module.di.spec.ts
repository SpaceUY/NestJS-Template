/**
 * Compiles the real module graph with the three contracts mocked: the unit specs replace every
 * collaborator, so only this one sees a wiring mistake (a missing provider, an adapter module
 * that does not export TokenizationProvider, the AuthModule guard).
 */
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { WalletProvisioning } from '../database/entities/wallet-provisioning.entity';
import { jwtScope } from '../auth/config/jwt.scope';
import { googleScope } from '../auth/google/config/google.scope';
import { auth0Scope } from '../auth/auth0/config/auth0.scope';
import { LoggerAbstractModule } from '../common/observability/logger/abstract/logger-abstract.module';
import { NestLoggerAdapter } from '../common/observability/logger/nest-adapter/nest-logger.adapter';
import { CardResolver } from './abstract/card-resolver';
import { MockCardResolver } from './abstract/mocks/card-resolver.mock';
import { MockTokenizationProvider } from './abstract/mocks/tokenization-provider.mock';
import { MockWalletProvisioningHooks } from './abstract/mocks/wallet-provisioning-hooks.mock';
import { TokenizationProvider } from './abstract/tokenization-provider';
import { WalletProvisioningAbstractModule } from './abstract/wallet-provisioning-abstract.module';
import { WalletProvisioningHooks } from './abstract/wallet-provisioning-hooks';
import { walletProvisioningScope } from './config/wallet-provisioning.scope';
import { TokenEventsService } from './token-events.service';
import { WalletProvisioningController } from './wallet-provisioning.controller';
import { WalletProvisioningService } from './wallet-provisioning.service';

@Module({
  providers: [
    { provide: TokenizationProvider, useClass: MockTokenizationProvider },
  ],
  exports: [TokenizationProvider],
})
class MockAdapterModule {}

/** What src/app.module.ts supplies globally: auth scopes, repositories and the module's scope. */
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
    { provide: googleScope.KEY, useValue: { enabled: false } },
    { provide: auth0Scope.KEY, useValue: { enabled: false } },
    {
      provide: walletProvisioningScope.KEY,
      useValue: { requestDedupeSeconds: 60, claimWindowMinutes: 30 },
    },
    { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
    {
      provide: getRepositoryToken(WalletProvisioning),
      useValue: { findOne: jest.fn() },
    },
  ],
  exports: [
    jwtScope.KEY,
    googleScope.KEY,
    auth0Scope.KEY,
    walletProvisioningScope.KEY,
    getRepositoryToken(User),
    getRepositoryToken(WalletProvisioning),
  ],
})
class AppContextStubModule {}

describe('WalletProvisioningAbstractModule (DI graph)', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        LoggerAbstractModule.forRoot({
          adapter: NestLoggerAdapter,
          isGlobal: true,
        }),
        AppContextStubModule,
        WalletProvisioningAbstractModule.forRoot({
          adapter: MockAdapterModule,
          cardResolver: MockCardResolver,
          hooks: MockWalletProvisioningHooks,
        }),
      ],
    }).compile();
    await moduleRef.init();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('resolves the controller and both services with the three contract mocks', () => {
    expect(moduleRef.get(WalletProvisioningController)).toBeInstanceOf(
      WalletProvisioningController,
    );
    expect(moduleRef.get(WalletProvisioningService)).toBeInstanceOf(
      WalletProvisioningService,
    );
    expect(moduleRef.get(TokenEventsService)).toBeInstanceOf(
      TokenEventsService,
    );
    expect(moduleRef.get(CardResolver)).toBeInstanceOf(MockCardResolver);
    expect(moduleRef.get(WalletProvisioningHooks)).toBeInstanceOf(
      MockWalletProvisioningHooks,
    );
    expect(
      moduleRef.get(TokenizationProvider, { strict: false }),
    ).toBeInstanceOf(MockTokenizationProvider);
  });
});
