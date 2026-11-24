/**
 * Compiles the core module with the real Pomelo modules, as src/app.module.ts registers them:
 * the adapter module must export TokenizationProvider, and the webhook controller must find
 * TokenEventsService through the core module being global.
 */
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { WalletProvisioning } from '../../database/entities/wallet-provisioning.entity';
import { jwtScope } from '../../auth/config/jwt.scope';
import { googleScope } from '../../auth/google/config/google.scope';
import { auth0Scope } from '../../auth/auth0/config/auth0.scope';
import { LoggerAbstractModule } from '../../common/observability/logger/abstract/logger-abstract.module';
import { NestLoggerAdapter } from '../../common/observability/logger/nest-adapter/nest-logger.adapter';
import { UnconfiguredCardResolver } from '../abstract/card-resolver';
import { TokenizationProvider } from '../abstract/tokenization-provider';
import { WalletProvisioningAbstractModule } from '../abstract/wallet-provisioning-abstract.module';
import { NoopWalletProvisioningHooks } from '../abstract/wallet-provisioning-hooks';
import { walletProvisioningScope } from '../config/wallet-provisioning.scope';
import { pomeloTokenizationScope } from './config/pomelo-tokenization.scope';
import { PomeloAdapterModule } from './pomelo-adapter.module';
import { PomeloTokenizationAdapter } from './pomelo-tokenization.adapter';
import { PomeloWebhooksController } from './pomelo-webhooks.controller';
import { PomeloWebhooksModule } from './pomelo-webhooks.module';

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
    {
      provide: pomeloTokenizationScope.KEY,
      useValue: {
        baseUrl: 'https://api.pomelo.example',
        allowedIps: [],
        requestTimeoutMs: 6500,
      },
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
    pomeloTokenizationScope.KEY,
    getRepositoryToken(User),
    getRepositoryToken(WalletProvisioning),
  ],
})
class AppContextStubModule {}

describe('Pomelo adapter modules (DI graph)', () => {
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
          adapter: PomeloAdapterModule,
          cardResolver: UnconfiguredCardResolver,
          hooks: NoopWalletProvisioningHooks,
        }),
        PomeloWebhooksModule,
      ],
    }).compile();
    await moduleRef.init();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('provides the Pomelo adapter as the TokenizationProvider', () => {
    expect(
      moduleRef.get(TokenizationProvider, { strict: false }),
    ).toBeInstanceOf(PomeloTokenizationAdapter);
  });

  it('resolves the webhook controller with the core TokenEventsService', () => {
    expect(moduleRef.get(PomeloWebhooksController)).toBeInstanceOf(
      PomeloWebhooksController,
    );
  });
});
