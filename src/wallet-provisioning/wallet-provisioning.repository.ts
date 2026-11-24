import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  QueryFailedError,
  Repository,
} from 'typeorm';
import {
  WalletProvider,
  WalletProvisioning,
  WalletProvisioningStatus,
} from '../database/entities/wallet-provisioning.entity';
import { IN_WALLET_STATUSES } from './token-transitions';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';

export type WalletProvisioningFilters = {
  status?: WalletProvisioningStatus;
  wallet?: WalletProvider;
  from?: Date;
  to?: Date;
};

export type ExpectedRowState = {
  status: WalletProvisioningStatus;
  tokenExternalId: string | null;
};

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError &&
  (error.driverError as { code?: string } | undefined)?.code ===
    POSTGRES_UNIQUE_VIOLATION_CODE;

const createdAtRange = (
  from?: Date,
  to?: Date,
): FindOptionsWhere<WalletProvisioning>['createdAt'] | undefined => {
  if (from && to) return Between(from, to);
  if (from) return MoreThanOrEqual(from);
  if (to) return LessThanOrEqual(to);
  return undefined;
};

@Injectable()
export class WalletProvisioningRepository {
  constructor(
    @InjectRepository(WalletProvisioning)
    private readonly repository: Repository<WalletProvisioning>,
  ) {}

  findByTokenExternalId(
    tokenExternalId: string,
  ): Promise<WalletProvisioning | null> {
    return this.repository.findOne({ where: { tokenExternalId } });
  }

  /** The newest REQUESTED row not yet claimed by a token, opened at or after `since`. */
  findLatestRequested(
    cardExternalId: string,
    wallet: WalletProvider,
    since: Date,
  ): Promise<WalletProvisioning | null> {
    return this.repository.findOne({
      where: {
        cardExternalId,
        wallet,
        status: 'REQUESTED',
        tokenExternalId: IsNull(),
        createdAt: MoreThanOrEqual(since),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /** Null when another event already created the row for the same token. */
  async insert(
    row: Partial<WalletProvisioning>,
  ): Promise<WalletProvisioning | null> {
    try {
      return await this.repository.save(this.repository.create(row));
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  /**
   * Writes only if the row is still in the state it was read in, so concurrent events cannot
   * overwrite each other or let two tokens claim the same row.
   */
  async compareAndSet(
    id: number,
    expected: ExpectedRowState,
    changes: Partial<WalletProvisioning>,
  ): Promise<boolean> {
    const result = await this.repository.update(
      {
        id,
        status: expected.status,
        tokenExternalId: expected.tokenExternalId ?? IsNull(),
      },
      changes,
    );
    return result.affected === 1;
  }

  existsInWallet(
    cardExternalId: string,
    wallet: WalletProvider,
  ): Promise<boolean> {
    return this.repository.exists({
      where: { cardExternalId, wallet, status: In([...IN_WALLET_STATUSES]) },
    });
  }

  findPaginated(
    filters: WalletProvisioningFilters,
    page: { skip: number; take: number },
  ): Promise<[WalletProvisioning[], number]> {
    const createdAt = createdAtRange(filters.from, filters.to);
    return this.repository.findAndCount({
      where: {
        ...(filters.status && { status: filters.status }),
        ...(filters.wallet && { wallet: filters.wallet }),
        ...(createdAt && { createdAt }),
      },
      order: { createdAt: 'DESC' },
      skip: page.skip,
      take: page.take,
    });
  }
}
