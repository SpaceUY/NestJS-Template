export type CardNetwork = 'MASTERCARD' | 'VISA';

// The column vocabulary lives with the entity (src/database cannot import from a feature).
export {
  WALLET_PROVISIONING_STATUSES,
  type WalletProvider,
  type WalletProvisioningStatus,
} from '../../database/entities/wallet-provisioning.entity';
import type {
  WalletProvider,
  WalletProvisioningStatus,
} from '../../database/entities/wallet-provisioning.entity';

export type ResolvedCard = {
  uuid: string;
  // The processor's id for the card.
  externalId: string;
  lastFour: string;
  network: CardNetwork;
  isActive: boolean;
  cardholderName?: string;
};

export type OwnedCard = ResolvedCard & { userUuid: string };

// All base64. Never log them.
export type ApplePayRequest = {
  certificates: string[];
  nonce: string;
  nonceSignature: string;
};

export type ApplePayData = {
  activationData: string;
  encryptedPassData: string;
  ephemeralPublicKey: string;
};

export type GooglePayRequest = { serverSessionId: string };

// Returned to the app exactly as the processor gives them. Never log them.
export type GooglePayData = { opc: string; googleOpc: string };

export type TokenEventKind = 'LIFECYCLE' | 'COMPLETED' | 'ABANDONED';

export type TokenEvent = {
  cardExternalId: string;
  tokenExternalId: string;
  wallet: WalletProvider;
  kind: TokenEventKind;
  status?: WalletProvisioningStatus;
  statusReason?: string;
};
