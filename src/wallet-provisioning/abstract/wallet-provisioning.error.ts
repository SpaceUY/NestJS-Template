export const WALLET_PROVISIONING_ERRORS = {
  PROVIDER_REQUEST_FAILED: 'WALLET_PROVISIONING_PROVIDER_REQUEST_FAILED',
  PROVIDER_TIMEOUT: 'WALLET_PROVISIONING_PROVIDER_TIMEOUT',
  PROVIDER_AUTH_FAILED: 'WALLET_PROVISIONING_PROVIDER_AUTH_FAILED',
  UNSUPPORTED_NETWORK: 'WALLET_PROVISIONING_UNSUPPORTED_NETWORK',
  CONCURRENT_UPDATE: 'WALLET_PROVISIONING_CONCURRENT_UPDATE',
} as const;

export type WalletProvisioningErrorCode =
  (typeof WALLET_PROVISIONING_ERRORS)[keyof typeof WALLET_PROVISIONING_ERRORS];

// `data` carries ids and status codes only, never request or response payloads.
export class WalletProvisioningError extends Error {
  constructor(
    public readonly code: WalletProvisioningErrorCode,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'WalletProvisioningError';
  }
}
