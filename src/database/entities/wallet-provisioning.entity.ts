import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export type WalletProvider = 'APPLE_PAY' | 'GOOGLE_PAY' | 'OTHER';

// The wallet-provisioning module's own status vocabulary: processor adapters translate theirs.
export const WALLET_PROVISIONING_STATUSES = [
  'REQUESTED',
  'OTP_PENDING',
  'OTP_SENT',
  'ACTIVATED',
  'SUSPENDED',
  'DISABLED',
  'INACTIVE',
  'ABANDONED',
  'FAILED',
] as const;

export type WalletProvisioningStatus =
  (typeof WALLET_PROVISIONING_STATUSES)[number];

/**
 * One attempt to add a card to a wallet, and the token it produced. Holds ids and statuses
 * only: never certificates, nonces, OPCs or any card data beyond the last four digits.
 */
@Entity()
@Index(['createdAt'])
// Unique among live rows so two first events for the same token cannot create two rows, while a
// soft-deleted row never blocks a new one.
@Index('IDX_wallet_provisioning_token_external_id', ['tokenExternalId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class WalletProvisioning extends BaseEntity {
  @Index('IDX_wallet_provisioning_user_uuid')
  @Column()
  userUuid!: string;

  @Index('IDX_wallet_provisioning_card_uuid')
  @Column()
  cardUuid!: string;

  // The processor's card id, as webhooks name it.
  @Index()
  @Column()
  cardExternalId!: string;

  @Column({ length: 4 })
  lastFour!: string;

  @Column({ type: 'varchar', length: 16 })
  wallet!: WalletProvider;

  @Column({ type: 'varchar', nullable: true })
  tokenExternalId!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  status!: WalletProvisioningStatus;

  @Column({ type: 'varchar', nullable: true })
  statusReason!: string | null;
}
