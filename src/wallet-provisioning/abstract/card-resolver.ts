import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { OwnedCard, ResolvedCard } from './wallet-provisioning.types';

/**
 * Where the cards come from. The template has no cards, so every project implements it.
 * `findForUser` must only return cards owned by that user: a card of someone else is `null`.
 */
export abstract class CardResolver {
  // Without cardUuid: the user's card (projects with one card per user).
  abstract findForUser(
    userUuid: string,
    cardUuid?: string,
  ): Promise<ResolvedCard | null>;

  // Any status: webhooks also report tokens of blocked or cancelled cards. Filtering to active
  // cards here would silently drop their SUSPENDED and DISABLED events.
  abstract findByExternalId(externalId: string): Promise<OwnedCard | null>;
}

/** Placeholder so the template boots: every request answers "card not eligible". */
@Injectable()
export class UnconfiguredCardResolver extends CardResolver {
  private warned = false;

  constructor(private readonly logger: LoggerService) {
    super();
    this.logger.setContext(UnconfiguredCardResolver.name);
  }

  findForUser(): Promise<ResolvedCard | null> {
    this.warnOnce();
    return Promise.resolve(null);
  }

  findByExternalId(): Promise<OwnedCard | null> {
    this.warnOnce();
    return Promise.resolve(null);
  }

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    this.logger.warn({
      message:
        'No CardResolver configured: wallet provisioning treats every card as unknown',
    });
  }
}
