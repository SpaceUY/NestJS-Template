import { LoggerService } from '../common/observability/logger/abstract/logger.service';
import {
  WalletProvisioning,
  WalletProvisioningStatus,
} from '../database/entities/wallet-provisioning.entity';
import { MockCardResolver } from './abstract/mocks/card-resolver.mock';
import { MockWalletProvisioningHooks } from './abstract/mocks/wallet-provisioning-hooks.mock';
import { WalletProvisioningError } from './abstract/wallet-provisioning.error';
import { OwnedCard, TokenEvent } from './abstract/wallet-provisioning.types';
import { TokenEventsService } from './token-events.service';
import { WalletProvisioningRepository } from './wallet-provisioning.repository';

const NOW = new Date('2026-11-18T12:00:00Z');
const minutesAgo = (minutes: number): Date =>
  new Date(NOW.getTime() - minutes * 60_000);

const card: OwnedCard = {
  uuid: 'card-uuid',
  userUuid: 'user-uuid',
  externalId: 'crd-1',
  lastFour: '1234',
  network: 'MASTERCARD',
  isActive: true,
};

const event = (overrides: Partial<TokenEvent> = {}): TokenEvent => ({
  cardExternalId: 'crd-1',
  tokenExternalId: 'tok-1',
  wallet: 'GOOGLE_PAY',
  kind: 'LIFECYCLE',
  status: 'OTP_SENT',
  ...overrides,
});

/** In-memory repository with the same compare-and-set semantics as the TypeORM one. */
class FakeRepository {
  rows: WalletProvisioning[] = [];
  private nextId = 1;
  beforeCompareAndSet: (() => void) | null = null;

  add(row: Partial<WalletProvisioning>): WalletProvisioning {
    const full = {
      id: this.nextId++,
      userUuid: 'user-uuid',
      cardUuid: 'card-uuid',
      cardExternalId: 'crd-1',
      lastFour: '1234',
      wallet: 'GOOGLE_PAY',
      tokenExternalId: null,
      status: 'REQUESTED',
      statusReason: null,
      createdAt: NOW,
      ...row,
    } as WalletProvisioning;
    this.rows.push(full);
    return full;
  }

  findByTokenExternalId = jest.fn(async (token: string) =>
    this.copy(this.rows.find((row) => row.tokenExternalId === token)),
  );

  findLatestRequested = jest.fn(
    async (cardExternalId: string, wallet: string, since: Date) =>
      this.copy(
        this.rows
          .filter(
            (row) =>
              row.cardExternalId === cardExternalId &&
              row.wallet === wallet &&
              row.status === 'REQUESTED' &&
              row.tokenExternalId === null &&
              row.createdAt >= since,
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0],
      ),
  );

  insert = jest.fn(async (row: Partial<WalletProvisioning>) => {
    if (
      row.tokenExternalId &&
      this.rows.some((r) => r.tokenExternalId === row.tokenExternalId)
    ) {
      return null;
    }
    return this.copy(this.add(row));
  });

  compareAndSet = jest.fn(
    async (
      id: number,
      expected: {
        status: WalletProvisioningStatus;
        tokenExternalId: string | null;
      },
      changes: Partial<WalletProvisioning>,
    ) => {
      this.beforeCompareAndSet?.();
      const row = this.rows.find(
        (r) =>
          r.id === id &&
          r.status === expected.status &&
          r.tokenExternalId === expected.tokenExternalId,
      );
      if (!row) return false;
      Object.assign(row, changes);
      return true;
    },
  );

  existsInWallet = jest.fn(async (cardExternalId: string, wallet: string) =>
    this.rows.some(
      (row) =>
        row.cardExternalId === cardExternalId &&
        row.wallet === wallet &&
        ['ACTIVATED', 'SUSPENDED'].includes(row.status),
    ),
  );

  private copy(row: WalletProvisioning | undefined): WalletProvisioning | null {
    return row ? { ...row } : null;
  }
}

describe('TokenEventsService', () => {
  let repository: FakeRepository;
  let resolver: MockCardResolver;
  let hooks: MockWalletProvisioningHooks;
  let logger: jest.Mocked<LoggerService>;
  let service: TokenEventsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    repository = new FakeRepository();
    resolver = new MockCardResolver();
    resolver.findByExternalId.mockResolvedValue(card);
    hooks = new MockWalletProvisioningHooks();
    logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;
    service = new TokenEventsService(
      repository as unknown as WalletProvisioningRepository,
      resolver,
      hooks,
      { requestDedupeSeconds: 60, claimWindowMinutes: 30 },
      logger,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('updates the row that already has the tokenExternalId', async () => {
    const row = repository.add({
      tokenExternalId: 'tok-1',
      status: 'OTP_PENDING',
    });
    await expect(service.apply(event())).resolves.toEqual({
      previousStatus: 'OTP_PENDING',
      status: 'OTP_SENT',
    });
    expect(repository.rows).toHaveLength(1);
    expect(repository.rows[0]).toEqual(
      expect.objectContaining({ id: row.id, status: 'OTP_SENT' }),
    );
  });

  it('claims the latest REQUESTED row of the same card and wallet within 30 minutes', async () => {
    repository.add({ createdAt: minutesAgo(20) });
    const latest = repository.add({ createdAt: minutesAgo(5) });
    await service.apply(event());
    expect(repository.rows.find((row) => row.id === latest.id)).toEqual(
      expect.objectContaining({ tokenExternalId: 'tok-1', status: 'OTP_SENT' }),
    );
    expect(repository.findLatestRequested).toHaveBeenCalledWith(
      'crd-1',
      'GOOGLE_PAY',
      minutesAgo(30),
    );
  });

  it('creates a new row when nothing matches', async () => {
    repository.add({ createdAt: minutesAgo(31) });
    await service.apply(event({ wallet: 'APPLE_PAY' }));
    const created = repository.rows.find(
      (row) => row.tokenExternalId === 'tok-1',
    );
    expect(created).toEqual(
      expect.objectContaining({
        userUuid: 'user-uuid',
        cardUuid: 'card-uuid',
        cardExternalId: 'crd-1',
        lastFour: '1234',
        wallet: 'APPLE_PAY',
        status: 'OTP_SENT',
      }),
    );
  });

  it('re-reads the row when a concurrent event created it first', async () => {
    repository.findByTokenExternalId.mockResolvedValueOnce(null);
    repository.add({
      tokenExternalId: 'tok-1',
      status: 'OTP_PENDING',
      createdAt: minutesAgo(40),
    });
    await service.apply(event());
    expect(repository.rows).toHaveLength(1);
    expect(repository.rows[0]?.status).toBe('OTP_SENT');
  });

  it('retries with the fresh row when a concurrent event changed it first', async () => {
    const row = repository.add({
      tokenExternalId: 'tok-1',
      status: 'OTP_PENDING',
    });
    repository.beforeCompareAndSet = () => {
      row.status = 'ACTIVATED';
      repository.beforeCompareAndSet = null;
    };
    await expect(service.apply(event({ status: 'OTP_SENT' }))).resolves.toEqual(
      {
        previousStatus: 'ACTIVATED',
        status: 'ACTIVATED',
      },
    );
    expect(repository.compareAndSet).toHaveBeenCalledTimes(2);
  });

  it('does not let a second token take over a row another event already claimed', async () => {
    const row = repository.add({});
    repository.beforeCompareAndSet = () => {
      row.tokenExternalId = 'tok-other';
      repository.beforeCompareAndSet = null;
    };
    await service.apply(event());
    expect(row.tokenExternalId).toBe('tok-other');
    expect(
      repository.rows.find((r) => r.tokenExternalId === 'tok-1'),
    ).toBeDefined();
  });

  it('throws CONCURRENT_UPDATE after 3 attempts', async () => {
    const row = repository.add({
      tokenExternalId: 'tok-1',
      status: 'OTP_PENDING',
    });
    repository.beforeCompareAndSet = () => {
      row.status = row.status === 'OTP_PENDING' ? 'OTP_SENT' : 'OTP_PENDING';
    };
    await expect(service.apply(event({ status: 'ACTIVATED' }))).rejects.toEqual(
      expect.objectContaining({
        code: 'WALLET_PROVISIONING_CONCURRENT_UPDATE',
      }),
    );
    expect(repository.compareAndSet).toHaveBeenCalledTimes(3);
    await expect(service.apply(event())).rejects.toBeInstanceOf(
      WalletProvisioningError,
    );
  });

  it('keeps the reason of a lifecycle event and clears it on the next one without a reason', async () => {
    const row = repository.add({
      tokenExternalId: 'tok-1',
      status: 'ACTIVATED',
    });
    await service.apply(event({ status: 'SUSPENDED', statusReason: 'FRAUD' }));
    expect(row.statusReason).toBe('FRAUD');
    await service.apply(event({ status: 'ACTIVATED' }));
    expect(row.statusReason).toBeNull();
  });

  it('calls onProvisioningAbandoned once when a pending row is abandoned and the card is not in that wallet', async () => {
    repository.add({ tokenExternalId: 'tok-1', status: 'OTP_SENT' });
    await service.apply(event({ kind: 'ABANDONED', status: undefined }));
    expect(hooks.onProvisioningAbandoned).toHaveBeenCalledWith({
      userUuid: 'user-uuid',
      cardUuid: 'card-uuid',
      wallet: 'GOOGLE_PAY',
    });
  });

  it('does not remind when the card is already in that wallet with another token', async () => {
    repository.add({ tokenExternalId: 'tok-old', status: 'ACTIVATED' });
    repository.add({ tokenExternalId: 'tok-1', status: 'OTP_SENT' });
    await service.apply(event({ kind: 'ABANDONED', status: undefined }));
    expect(hooks.onProvisioningAbandoned).not.toHaveBeenCalled();
  });

  it('a repeated abandoned notification does not remind twice', async () => {
    repository.add({ tokenExternalId: 'tok-1', status: 'OTP_SENT' });
    await service.apply(event({ kind: 'ABANDONED', status: undefined }));
    await service.apply(event({ kind: 'ABANDONED', status: undefined }));
    expect(hooks.onProvisioningAbandoned).toHaveBeenCalledTimes(1);
  });

  it('does not remind when the abandoned notification arrives after activation', async () => {
    repository.add({ tokenExternalId: 'tok-1', status: 'ACTIVATED' });
    await service.apply(event({ kind: 'ABANDONED', status: undefined }));
    expect(hooks.onProvisioningAbandoned).not.toHaveBeenCalled();
  });

  it('a failing hook does not fail apply and logs only the card uuid', async () => {
    hooks.onProvisioningAbandoned.mockRejectedValue(
      new Error('push failed: token ExponentPushToken[abc]'),
    );
    repository.add({ tokenExternalId: 'tok-1', status: 'OTP_SENT' });
    await expect(
      service.apply(event({ kind: 'ABANDONED', status: undefined })),
    ).resolves.toEqual({
      previousStatus: 'OTP_SENT',
      status: 'ABANDONED',
    });
    expect(logger.error).toHaveBeenCalledWith({
      message: 'Abandoned provisioning hook failed',
      data: { cardUuid: 'card-uuid' },
    });
  });

  it('ignores events for a card the resolver does not know, without writing', async () => {
    resolver.findByExternalId.mockResolvedValue(null);
    await expect(service.apply(event())).resolves.toBeNull();
    expect(repository.insert).not.toHaveBeenCalled();
    expect(repository.compareAndSet).not.toHaveBeenCalled();
    expect(hooks.onProvisioningAbandoned).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({
      message: 'Token event for an unknown card',
      data: { cardExternalId: 'crd-1' },
    });
  });
});
