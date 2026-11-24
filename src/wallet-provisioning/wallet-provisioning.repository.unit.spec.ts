import {
  Between,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { WalletProvisioning } from '../database/entities/wallet-provisioning.entity';
import { WalletProvisioningRepository } from './wallet-provisioning.repository';

type MockedMethods = Pick<
  Repository<WalletProvisioning>,
  'create' | 'save' | 'findOne' | 'update' | 'exists' | 'findAndCount'
>;

const uniqueViolation = (): QueryFailedError => {
  const error = new QueryFailedError('INSERT', [], new Error('duplicate'));
  Object.assign(error, { driverError: { code: '23505' } });
  return error;
};

describe('WalletProvisioningRepository', () => {
  let repository: WalletProvisioningRepository;
  let typeorm: jest.Mocked<MockedMethods>;

  beforeEach(() => {
    typeorm = {
      create: jest.fn((row: Partial<WalletProvisioning>) => row),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      exists: jest.fn(),
      findAndCount: jest.fn(),
    } as unknown as jest.Mocked<MockedMethods>;
    repository = new WalletProvisioningRepository(
      typeorm as unknown as Repository<WalletProvisioning>,
    );
  });

  it('findByTokenExternalId looks the token up', async () => {
    await repository.findByTokenExternalId('tok-1');
    expect(typeorm.findOne).toHaveBeenCalledWith({
      where: { tokenExternalId: 'tok-1' },
    });
  });

  it('findLatestRequested looks for the newest REQUESTED row without a token since a date', async () => {
    const since = new Date('2026-11-18T10:00:00Z');
    await repository.findLatestRequested('crd-1', 'APPLE_PAY', since);
    expect(typeorm.findOne).toHaveBeenCalledWith({
      where: {
        cardExternalId: 'crd-1',
        wallet: 'APPLE_PAY',
        status: 'REQUESTED',
        tokenExternalId: IsNull(),
        createdAt: MoreThanOrEqual(since),
      },
      order: { createdAt: 'DESC' },
    });
  });

  it('insert saves the row', async () => {
    typeorm.save.mockResolvedValue({ id: 1 } as WalletProvisioning);
    await expect(
      repository.insert({ cardExternalId: 'crd-1' }),
    ).resolves.toEqual({ id: 1 });
  });

  it('insert returns null when the token already has a row', async () => {
    typeorm.save.mockRejectedValue(uniqueViolation());
    await expect(
      repository.insert({ tokenExternalId: 'tok-1' }),
    ).resolves.toBeNull();
  });

  it('insert rethrows other database errors', async () => {
    typeorm.save.mockRejectedValue(new Error('connection lost'));
    await expect(repository.insert({})).rejects.toThrow('connection lost');
  });

  it('compareAndSet updates only the row in the expected state', async () => {
    typeorm.update.mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });
    await expect(
      repository.compareAndSet(
        7,
        { status: 'REQUESTED', tokenExternalId: null },
        { status: 'FAILED' },
      ),
    ).resolves.toBe(true);
    expect(typeorm.update).toHaveBeenCalledWith(
      { id: 7, status: 'REQUESTED', tokenExternalId: IsNull() },
      { status: 'FAILED' },
    );
  });

  it('compareAndSet matches an existing token by value', async () => {
    typeorm.update.mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });
    await repository.compareAndSet(
      7,
      { status: 'OTP_SENT', tokenExternalId: 'tok-1' },
      { status: 'ACTIVATED' },
    );
    expect(typeorm.update).toHaveBeenCalledWith(
      { id: 7, status: 'OTP_SENT', tokenExternalId: 'tok-1' },
      { status: 'ACTIVATED' },
    );
  });

  it('compareAndSet returns false when no row was affected', async () => {
    typeorm.update.mockResolvedValue({
      affected: 0,
      raw: [],
      generatedMaps: [],
    });
    await expect(
      repository.compareAndSet(
        7,
        { status: 'REQUESTED', tokenExternalId: null },
        { status: 'FAILED' },
      ),
    ).resolves.toBe(false);
  });

  it('existsInWallet looks for an active or suspended token of the card in that wallet', async () => {
    typeorm.exists.mockResolvedValue(true);
    await expect(
      repository.existsInWallet('crd-1', 'GOOGLE_PAY'),
    ).resolves.toBe(true);
    expect(typeorm.exists).toHaveBeenCalledWith({
      where: {
        cardExternalId: 'crd-1',
        wallet: 'GOOGLE_PAY',
        status: In(['ACTIVATED', 'SUSPENDED']),
      },
    });
  });

  it('findPaginated filters by status, wallet and date range, newest first', async () => {
    const from = new Date('2026-11-01T00:00:00Z');
    const to = new Date('2026-11-18T00:00:00Z');
    typeorm.findAndCount.mockResolvedValue([[], 0]);
    await repository.findPaginated(
      { status: 'ACTIVATED', wallet: 'APPLE_PAY', from, to },
      { skip: 20, take: 10 },
    );
    expect(typeorm.findAndCount).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVATED',
        wallet: 'APPLE_PAY',
        createdAt: Between(from, to),
      },
      order: { createdAt: 'DESC' },
      skip: 20,
      take: 10,
    });
  });

  it('findPaginated supports an open date range', async () => {
    const from = new Date('2026-11-01T00:00:00Z');
    typeorm.findAndCount.mockResolvedValue([[], 0]);
    await repository.findPaginated({ from }, { skip: 0, take: 10 });
    expect(typeorm.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { createdAt: MoreThanOrEqual(from) } }),
    );
  });

  it('findPaginated supports a range open at the start, and no filters at all', async () => {
    const to = new Date('2026-11-18T00:00:00Z');
    typeorm.findAndCount.mockResolvedValue([[], 0]);
    await repository.findPaginated({ to }, { skip: 0, take: 10 });
    await repository.findPaginated({}, { skip: 0, take: 10 });
    expect(typeorm.findAndCount.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ where: { createdAt: LessThanOrEqual(to) } }),
    );
    expect(typeorm.findAndCount.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ where: {} }),
    );
  });
});
