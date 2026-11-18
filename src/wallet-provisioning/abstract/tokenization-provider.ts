import {
  ApplePayData,
  ApplePayRequest,
  GooglePayData,
  GooglePayRequest,
  ResolvedCard,
} from './wallet-provisioning.types';

/**
 * The card processor. Implementations throw `WalletProvisioningError` only, never the
 * processor's own errors or response bodies (they can echo the nonce or the certificates).
 */
export abstract class TokenizationProvider {
  abstract getApplePayData(
    card: ResolvedCard,
    request: ApplePayRequest,
  ): Promise<ApplePayData>;

  abstract getGooglePayData(
    card: ResolvedCard,
    request: GooglePayRequest,
  ): Promise<GooglePayData>;
}
