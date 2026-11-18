import { HttpStatus } from '@nestjs/common';
import { LoggerService } from '../common/observability/logger/abstract/logger.service';
import { RequestException } from '../common/exception/core/ExceptionBase';
import { WalletProvisioning } from '../database/entities/wallet-provisioning.entity';
import { MockCardResolver } from './abstract/mocks/card-resolver.mock';
import { MockTokenizationProvider } from './abstract/mocks/tokenization-provider.mock';
import {
  WALLET_PROVISIONING_ERRORS,
  WalletProvisioningError,
} from './abstract/wallet-provisioning.error';
import { ResolvedCard } from './abstract/wallet-provisioning.types';
import { WalletProvisioningRepository } from './wallet-provisioning.repository';
import { WalletProvisioningService } from './wallet-provisioning.service';

const NOW = new Date('2026-11-18T12:00:00Z');

const card: ResolvedCard = {
  uuid: 'card-uuid',
  externalId: 'crd-1',
  lastFour: '1234',
  network: 'MASTERCARD',
  isActive: true,
  cardholderName: 'Ana Perez',
};

const appleRequest = {
  certificates: ['Q0VSVA=='],
  nonce: 'Tk9OQ0U=',
  nonceSignature: 'U0lH',
};

const requestedRow = {
  id: 7,
  status: 'REQUESTED',
  tokenExternalId: null,
} as WalletProvisioning;

describe('WalletProvisioningService', () => {
  let repository: jest.Mocked<
    Pick<
      WalletProvisioningRepository,
      'findLatestRequested' | 'insert' | 'compareAndSet' | 'findPaginated'
    >
  >;
  let resolver: MockCardResolver;
  let provider: MockTokenizationProvider;
  let logger: jest.Mocked<LoggerService>;
  let service: WalletProvisioningService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    repository = {
      findLatestRequested: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue(requestedRow),
      compareAndSet: jest.fn().mockResolvedValue(true),
      findPaginated: jest.fn().mockResolvedValue([[], 0]),
    };
    resolver = new MockCardResolver();
    resolver.findForUser.mockResolvedValue(card);
    provider = new MockTokenizationProvider();
    logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;
    service = new WalletProvisioningService(
      repository as unknown as WalletProvisioningRepository,
      resolver,
      provider,
      { requestDedupeSeconds: 60, claimWindowMinutes: 30 },
      logger,
    );
  });

  afterEach(() => jest.useRealTimers());

  const statusOf = async (promise: Promise<unknown>): Promise<number> => {
    try {
      await promise;
    } catch (error) {
      if (error instanceof RequestException) return error.getStatus();
      throw error;
    }
    throw new Error('expected a RequestException');
  };

  it('answers 400 when the card does not exist', async () => {
    resolver.findForUser.mockResolvedValue(null);
    expect(
      await statusOf(service.getApplePayData('user-uuid', appleRequest)),
    ).toBe(HttpStatus.BAD_REQUEST);
    expect(provider.getApplePayData).not.toHaveBeenCalled();
  });

  it('answers 400 when the card is inactive', async () => {
    resolver.findForUser.mockResolvedValue({ ...card, isActive: false });
    expect(
      await statusOf(
        service.getGooglePayData('user-uuid', { serverSessionId: 'SID' }),
      ),
    ).toBe(HttpStatus.BAD_REQUEST);
  });

  it('answers 400 when cardId belongs to another user', async () => {
    resolver.findForUser.mockImplementation(
      async (userUuid: string, cardUuid?: string) =>
        userUuid === 'owner' && cardUuid === 'card-uuid' ? card : null,
    );
    expect(
      await statusOf(
        service.getApplePayData('someone-else', {
          ...appleRequest,
          cardId: 'card-uuid',
        }),
      ),
    ).toBe(HttpStatus.BAD_REQUEST);
    expect(resolver.findForUser).toHaveBeenCalledWith(
      'someone-else',
      'card-uuid',
    );
  });

  it('passes the resolved card and request to the provider and returns its data unchanged', async () => {
    const result = await service.getApplePayData('user-uuid', appleRequest);
    expect(provider.getApplePayData).toHaveBeenCalledWith(card, appleRequest);
    expect(result).toEqual(
      await provider.getApplePayData.mock.results[0]?.value,
    );
    await service.getGooglePayData('user-uuid', {
      serverSessionId: 'SID',
      cardId: 'card-uuid',
    });
    expect(provider.getGooglePayData).toHaveBeenCalledWith(card, {
      serverSessionId: 'SID',
    });
  });

  it('opens a REQUESTED row for the card and wallet', async () => {
    await service.getGooglePayData('user-uuid', { serverSessionId: 'SID' });
    expect(repository.insert).toHaveBeenCalledWith({
      userUuid: 'user-uuid',
      cardUuid: 'card-uuid',
      cardExternalId: 'crd-1',
      lastFour: '1234',
      wallet: 'GOOGLE_PAY',
      tokenExternalId: null,
      status: 'REQUESTED',
      statusReason: null,
    });
  });

  it('reuses a REQUESTED row opened in the last 60 seconds', async () => {
    repository.findLatestRequested.mockResolvedValue(requestedRow);
    await service.getApplePayData('user-uuid', appleRequest);
    expect(repository.findLatestRequested).toHaveBeenCalledWith(
      'crd-1',
      'APPLE_PAY',
      new Date(NOW.getTime() - 60_000),
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('marks the row FAILED and answers 502 without provider detail on WalletProvisioningError', async () => {
    provider.getGooglePayData.mockRejectedValue(
      new WalletProvisioningError(
        WALLET_PROVISIONING_ERRORS.PROVIDER_TIMEOUT,
        'Processor said: nonce=Tk9OQ0U=',
      ),
    );
    const call = service.getGooglePayData('user-uuid', {
      serverSessionId: 'SID',
    });
    const error = await call.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RequestException);
    expect((error as RequestException).getStatus()).toBe(
      HttpStatus.BAD_GATEWAY,
    );
    expect(
      JSON.stringify((error as RequestException).getResponse()),
    ).not.toContain('nonce');
    expect(repository.compareAndSet).toHaveBeenCalledWith(
      7,
      { status: 'REQUESTED', tokenExternalId: null },
      { status: 'FAILED' },
    );
  });

  it('marks the row FAILED and rethrows an unexpected error', async () => {
    provider.getApplePayData.mockRejectedValue(new TypeError('bug'));
    await expect(
      service.getApplePayData('user-uuid', appleRequest),
    ).rejects.toThrow('bug');
    expect(repository.compareAndSet).toHaveBeenCalled();
  });

  it('never logs request or response payloads', async () => {
    provider.getApplePayData.mockRejectedValue(
      new WalletProvisioningError(
        WALLET_PROVISIONING_ERRORS.PROVIDER_REQUEST_FAILED,
        'failed',
      ),
    );
    await service
      .getApplePayData('user-uuid', appleRequest)
      .catch(() => undefined);
    await service.getGooglePayData('user-uuid', { serverSessionId: 'SID' });
    const logged = JSON.stringify([
      ...logger.log.mock.calls,
      ...logger.warn.mock.calls,
      ...logger.error.mock.calls,
      ...logger.debug.mock.calls,
    ]);
    for (const secret of [
      'Q0VSVA==',
      'Tk9OQ0U=',
      'U0lH',
      'SID',
      'OPC',
      'GOPC',
    ]) {
      expect(logged).not.toContain(secret);
    }
    expect(logger.warn).toHaveBeenCalledWith({
      message: 'Wallet provisioning request failed',
      data: {
        cardUuid: 'card-uuid',
        code: WALLET_PROVISIONING_ERRORS.PROVIDER_REQUEST_FAILED,
      },
    });
  });

  it('findPaginated pages the rows newest first', async () => {
    await service.findPaginated(
      { status: 'ACTIVATED' },
      { page: 3, limit: 10 },
    );
    expect(repository.findPaginated).toHaveBeenCalledWith(
      { status: 'ACTIVATED' },
      { skip: 20, take: 10 },
    );
  });
});
