import { getMetadataArgsStorage } from 'typeorm';
import { BaseEntity } from './base.entity';
import { WalletProvisioning } from './wallet-provisioning.entity';

const columnsOf = (target: object): string[] =>
  getMetadataArgsStorage()
    .columns.filter((column) => column.target === target)
    .map((column) => column.propertyName);

const indexedColumns = (): string[] =>
  getMetadataArgsStorage()
    .indices.filter((index) => index.target === WalletProvisioning)
    .flatMap((index) =>
      typeof index.columns === 'function' ? [] : (index.columns ?? []),
    );

describe('WalletProvisioning entity', () => {
  it('has no column for sensitive provisioning data', () => {
    expect(columnsOf(WalletProvisioning).sort()).toEqual(
      [
        'userUuid',
        'cardUuid',
        'cardExternalId',
        'lastFour',
        'wallet',
        'tokenExternalId',
        'status',
        'statusReason',
      ].sort(),
    );
  });

  it('extends BaseEntity', () => {
    expect(new WalletProvisioning()).toBeInstanceOf(BaseEntity);
  });

  // Unique among live rows only, so a soft-deleted row never blocks a new event for that token.
  it('keeps tokenExternalId unique among rows that are not soft-deleted', () => {
    const index = getMetadataArgsStorage().indices.find(
      (candidate) =>
        candidate.target === WalletProvisioning &&
        Array.isArray(candidate.columns) &&
        candidate.columns.includes('tokenExternalId'),
    );
    expect(index).toEqual(
      expect.objectContaining({ unique: true, where: '"deletedAt" IS NULL' }),
    );
  });

  it('indexes the owner, the card, the status and the creation date', () => {
    expect(indexedColumns()).toEqual(
      expect.arrayContaining([
        'userUuid',
        'cardUuid',
        'cardExternalId',
        'status',
        'createdAt',
      ]),
    );
  });
});
