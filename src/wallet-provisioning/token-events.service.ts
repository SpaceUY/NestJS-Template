import { Inject, Injectable } from '@nestjs/common';
import { LoggerService } from '../common/observability/logger/abstract/logger.service';
import {
  WalletProvisioning,
  WalletProvisioningStatus,
} from '../database/entities/wallet-provisioning.entity';
import { CardResolver } from './abstract/card-resolver';
import { WalletProvisioningHooks } from './abstract/wallet-provisioning-hooks';
import {
  WALLET_PROVISIONING_ERRORS,
  WalletProvisioningError,
} from './abstract/wallet-provisioning.error';
import { OwnedCard, TokenEvent } from './abstract/wallet-provisioning.types';
import {
  walletProvisioningScope,
  WalletProvisioningScopeConfig,
} from './config/wallet-provisioning.scope';
import {
  nextStatus,
  nextStatusReason,
  PENDING_STATUSES,
} from './token-transitions';
import { WalletProvisioningRepository } from './wallet-provisioning.repository';

// A concurrent event can change the row between reading and writing it.
const MAX_APPLY_ATTEMPTS = 3;

export type AppliedTokenEvent = {
  previousStatus: WalletProvisioningStatus;
  status: WalletProvisioningStatus;
};

/** Applies processor-agnostic token events to the provisioning rows (the state machine). */
@Injectable()
export class TokenEventsService {
  constructor(
    private readonly repository: WalletProvisioningRepository,
    private readonly cardResolver: CardResolver,
    private readonly hooks: WalletProvisioningHooks,
    @Inject(walletProvisioningScope.KEY)
    private readonly config: WalletProvisioningScopeConfig,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(TokenEventsService.name);
  }

  /** Null when the card is unknown to this project: nothing is written. */
  async apply(event: TokenEvent): Promise<AppliedTokenEvent | null> {
    const card = await this.cardResolver.findByExternalId(event.cardExternalId);
    if (!card) {
      this.logger.warn({
        message: 'Token event for an unknown card',
        data: { cardExternalId: event.cardExternalId },
      });
      return null;
    }

    for (let attempt = 0; attempt < MAX_APPLY_ATTEMPTS; attempt += 1) {
      const row = await this.findOrCreateRow(event, card);
      const status = nextStatus(row.status, event);
      const written = await this.repository.compareAndSet(
        row.id,
        { status: row.status, tokenExternalId: row.tokenExternalId },
        {
          tokenExternalId: event.tokenExternalId,
          status,
          statusReason: nextStatusReason(row.statusReason, event, status),
        },
      );
      if (written) {
        await this.remindIfAbandoned(row.status, status, event, card);
        return { previousStatus: row.status, status };
      }
    }
    throw new WalletProvisioningError(
      WALLET_PROVISIONING_ERRORS.CONCURRENT_UPDATE,
      'Wallet provisioning changed while applying the token event',
      { cardExternalId: event.cardExternalId },
    );
  }

  private async findOrCreateRow(
    event: TokenEvent,
    card: OwnedCard,
  ): Promise<WalletProvisioning> {
    const claimSince = new Date(
      Date.now() - this.config.claimWindowMinutes * 60_000,
    );
    return (
      (await this.repository.findByTokenExternalId(event.tokenExternalId)) ??
      (await this.repository.findLatestRequested(
        event.cardExternalId,
        event.wallet,
        claimSince,
      )) ??
      (await this.createForToken(event, card))
    );
  }

  // Two first events for a token added from Wallet can race on the unique index.
  private async createForToken(
    event: TokenEvent,
    card: OwnedCard,
  ): Promise<WalletProvisioning> {
    const created =
      (await this.repository.insert({
        userUuid: card.userUuid,
        cardUuid: card.uuid,
        cardExternalId: event.cardExternalId,
        lastFour: card.lastFour,
        wallet: event.wallet,
        tokenExternalId: event.tokenExternalId,
        status: 'REQUESTED',
        statusReason: null,
      })) ??
      (await this.repository.findByTokenExternalId(event.tokenExternalId));
    if (!created) {
      throw new WalletProvisioningError(
        WALLET_PROVISIONING_ERRORS.CONCURRENT_UPDATE,
        'Wallet provisioning row vanished while applying the token event',
        { cardExternalId: event.cardExternalId },
      );
    }
    return created;
  }

  // Only the event that abandons a pending flow reminds, and not when the card is already in
  // that wallet through another token.
  private async remindIfAbandoned(
    previous: WalletProvisioningStatus,
    status: WalletProvisioningStatus,
    event: TokenEvent,
    card: OwnedCard,
  ): Promise<void> {
    if (status !== 'ABANDONED' || !PENDING_STATUSES.has(previous)) return;
    // A card blocked meanwhile cannot be added: a reminder would only lead to a 400.
    if (!card.isActive) return;
    if (
      await this.repository.existsInWallet(event.cardExternalId, event.wallet)
    ) {
      return;
    }
    try {
      await this.hooks.onProvisioningAbandoned({
        userUuid: card.userUuid,
        cardUuid: card.uuid,
        wallet: event.wallet,
      });
    } catch {
      this.logger.error({
        message: 'Abandoned provisioning hook failed',
        data: { cardUuid: card.uuid },
      });
    }
  }
}
