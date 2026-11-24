import { Inject, Injectable } from '@nestjs/common';
import { LoggerService } from '../common/observability/logger/abstract/logger.service';
import { RequestException } from '../common/exception/core/ExceptionBase';
import {
  WalletProvider,
  WalletProvisioning,
} from '../database/entities/wallet-provisioning.entity';
import { CardResolver } from './abstract/card-resolver';
import { TokenizationProvider } from './abstract/tokenization-provider';
import { WalletProvisioningError } from './abstract/wallet-provisioning.error';
import {
  ApplePayData,
  ApplePayRequest,
  GooglePayData,
  GooglePayRequest,
  ResolvedCard,
} from './abstract/wallet-provisioning.types';
import {
  walletProvisioningScope,
  WalletProvisioningScopeConfig,
} from './config/wallet-provisioning.scope';
import {
  WalletProvisioningFilters,
  WalletProvisioningRepository,
} from './wallet-provisioning.repository';
import { WalletProvisioningExceptions } from './wallet-provisioning.exceptions';

type WithCardId<T> = T & { cardId?: string };

@Injectable()
export class WalletProvisioningService {
  constructor(
    private readonly repository: WalletProvisioningRepository,
    private readonly cardResolver: CardResolver,
    private readonly provider: TokenizationProvider,
    @Inject(walletProvisioningScope.KEY)
    private readonly config: WalletProvisioningScopeConfig,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(WalletProvisioningService.name);
  }

  getApplePayData(
    userUuid: string,
    { cardId, ...request }: WithCardId<ApplePayRequest>,
  ): Promise<ApplePayData> {
    return this.provision(userUuid, cardId, 'APPLE_PAY', (card) =>
      this.provider.getApplePayData(card, request),
    );
  }

  getGooglePayData(
    userUuid: string,
    { cardId, ...request }: WithCardId<GooglePayRequest>,
  ): Promise<GooglePayData> {
    return this.provision(userUuid, cardId, 'GOOGLE_PAY', (card) =>
      this.provider.getGooglePayData(card, request),
    );
  }

  /** For a project's admin listing; the module exposes no route for it. */
  findPaginated(
    filters: WalletProvisioningFilters,
    { page, limit }: { page: number; limit: number },
  ): Promise<[WalletProvisioning[], number]> {
    return this.repository.findPaginated(filters, {
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  private async provision<T>(
    userUuid: string,
    cardId: string | undefined,
    wallet: WalletProvider,
    request: (card: ResolvedCard) => Promise<T>,
  ): Promise<T> {
    const card = await this.cardResolver.findForUser(userUuid, cardId);
    if (!card?.isActive) {
      throw new RequestException(
        WalletProvisioningExceptions.cardNotEligible(),
      );
    }
    const row = await this.openRequest(userUuid, card, wallet);
    try {
      return await request(card);
    } catch (error) {
      await this.markFailed(row, card.uuid);
      const code =
        error instanceof WalletProvisioningError ? error.code : 'UNEXPECTED';
      this.logger.warn({
        message: 'Wallet provisioning request failed',
        data: { cardUuid: card.uuid, code },
      });
      if (error instanceof WalletProvisioningError) {
        throw new RequestException(
          WalletProvisioningExceptions.providerUnavailable(),
        );
      }
      throw error;
    }
  }

  // Repeated requests in the dedupe window share one REQUESTED row.
  private async openRequest(
    userUuid: string,
    card: ResolvedCard,
    wallet: WalletProvider,
  ): Promise<WalletProvisioning | null> {
    const since = new Date(
      Date.now() - this.config.requestDedupeSeconds * 1000,
    );
    return (
      (await this.repository.findLatestRequested(
        card.externalId,
        wallet,
        since,
      )) ??
      (await this.repository.insert({
        userUuid,
        cardUuid: card.uuid,
        cardExternalId: card.externalId,
        lastFour: card.lastFour,
        wallet,
        tokenExternalId: null,
        status: 'REQUESTED',
        statusReason: null,
      }))
    );
  }

  // Only while no token has claimed the row: a webhook may already have moved it on. A database
  // failure here must not hide why the request failed, so it is logged and swallowed.
  private async markFailed(
    row: WalletProvisioning | null,
    cardUuid: string,
  ): Promise<void> {
    if (!row) return;
    try {
      await this.repository.compareAndSet(
        row.id,
        { status: 'REQUESTED', tokenExternalId: null },
        { status: 'FAILED' },
      );
    } catch {
      this.logger.warn({
        message: 'Could not mark the wallet provisioning request as failed',
        data: { cardUuid },
      });
    }
  }
}
