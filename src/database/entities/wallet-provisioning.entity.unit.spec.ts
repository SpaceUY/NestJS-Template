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

  it('keeps tokenExternalId unique and nullable', () => {
    const column = getMetadataArgsStorage().columns.find(
      (candidate) =>
        candidate.target === WalletProvisioning &&
        candidate.propertyName === 'tokenExternalId',
    );
    expect(column?.options).toEqual(
      expect.objectContaining({ unique: true, nullable: true }),
    );
  });

  it('indexes the card, the status and the creation date', () => {
    expect(indexedColumns()).toEqual(
      expect.arrayContaining(['cardExternalId', 'status', 'createdAt']),
    );
  });
});
