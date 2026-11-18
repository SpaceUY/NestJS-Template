import { Injectable } from '@nestjs/common';
import { WalletProvider } from './wallet-provisioning.types';

export type ProvisioningAbandonedEvent = {
  userUuid: string;
  cardUuid: string;
  wallet: WalletProvider;
};

/**
 * Project reactions to token events. Apple asks issuers to remind users who left the add flow
 * unfinished; a project usually sends a push here. A failure never fails the webhook.
 */
export abstract class WalletProvisioningHooks {
  abstract onProvisioningAbandoned(
    event: ProvisioningAbandonedEvent,
  ): Promise<void>;
}

@Injectable()
export class NoopWalletProvisioningHooks extends WalletProvisioningHooks {
  onProvisioningAbandoned(): Promise<void> {
    return Promise.resolve();
  }
}
