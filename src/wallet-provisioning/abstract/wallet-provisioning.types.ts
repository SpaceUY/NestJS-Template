export type CardNetwork = 'MASTERCARD' | 'VISA';

export type WalletProvider = 'APPLE_PAY' | 'GOOGLE_PAY' | 'OTHER';

export const WALLET_PROVIDERS: readonly WalletProvider[] = [
  'APPLE_PAY',
  'GOOGLE_PAY',
  'OTHER',
];

// The module's own vocabulary: processor adapters translate their statuses to these.
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
