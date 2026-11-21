import { Inject, Injectable } from '@nestjs/common';
import { TokenizationProvider } from '../abstract/tokenization-provider';
import {
  WALLET_PROVISIONING_ERRORS,
  WalletProvisioningError,
} from '../abstract/wallet-provisioning.error';
import {
  ApplePayData,
  ApplePayRequest,
  GooglePayData,
  GooglePayRequest,
  ResolvedCard,
} from '../abstract/wallet-provisioning.types';
import {
  pomeloTokenizationScope,
  PomeloTokenizationScopeConfig,
} from './config/pomelo-tokenization.scope';
import { PomeloAuthClient } from './pomelo-auth.client';
import { isSuccess, postJson } from './pomelo-http';
import {
  PomeloApplePayData,
  PomeloApplePayRequest,
  PomeloGooglePayData,
  PomeloGooglePayRequest,
} from './pomelo.types';

type Wallet = 'applePay' | 'googlePay';

@Injectable()
export class PomeloTokenizationAdapter extends TokenizationProvider {
  constructor(
    @Inject(pomeloTokenizationScope.KEY)
    private readonly config: PomeloTokenizationScopeConfig,
    private readonly auth: PomeloAuthClient,
  ) {
    super();
  }

  async getApplePayData(
    card: ResolvedCard,
    request: ApplePayRequest,
  ): Promise<ApplePayData> {
    const data = await this.post<PomeloApplePayRequest, PomeloApplePayData>(
      card,
      'applePay',
      {
        card_id: card.externalId,
        certificates: request.certificates,
        nonce: request.nonce,
        nonce_signature: request.nonceSignature,
      },
    );
    return {
      activationData: data.activation_data,
      encryptedPassData: data.encrypted_pass_data,
      ephemeralPublicKey: data.ephemeral_public_key,
    };
  }

  async getGooglePayData(
    card: ResolvedCard,
    request: GooglePayRequest,
  ): Promise<GooglePayData> {
    const data = await this.post<PomeloGooglePayRequest, PomeloGooglePayData>(
      card,
      'googlePay',
      { card_id: card.externalId, server_session_id: request.serverSessionId },
    );
    return { opc: data.opc, googleOpc: data.google_opc };
  }

  private pathFor(card: ResolvedCard, wallet: Wallet): string | undefined {
    const paths = {
      MASTERCARD: {
        applePay: this.config.mastercardApplePayPath,
        googlePay: this.config.mastercardGooglePayPath,
      },
      VISA: {
        applePay: this.config.visaApplePayPath,
        googlePay: this.config.visaGooglePayPath,
      },
    };
    return paths[card.network][wallet];
  }

  private async post<Body, Data>(
    card: ResolvedCard,
    wallet: Wallet,
    body: Body,
  ): Promise<Data> {
    const path = this.pathFor(card, wallet);
    if (!path) {
      throw new WalletProvisioningError(
        WALLET_PROVISIONING_ERRORS.UNSUPPORTED_NETWORK,
        `No Pomelo ${wallet} path configured for ${card.network}`,
        { cardExternalId: card.externalId },
      );
    }
    // One budget for the token and the call, so a cold token cache cannot double the wait.
    const deadline = Date.now() + this.config.requestTimeoutMs;
    const token = await this.auth.getToken(this.config.requestTimeoutMs);
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new WalletProvisioningError(
        WALLET_PROVISIONING_ERRORS.PROVIDER_TIMEOUT,
        `Pomelo did not answer within ${this.config.requestTimeoutMs} ms`,
        { cardExternalId: card.externalId },
      );
    }
    const { status, body: response } = await postJson(
      `${this.config.baseUrl}${path}`,
      body,
      { Authorization: `Bearer ${token}` },
      remainingMs,
    );
    if (status === 401 || status === 403) this.auth.invalidate();
    const data = (response as { data?: Data } | null)?.data;
    if (!isSuccess(status) || !data) {
      throw new WalletProvisioningError(
        WALLET_PROVISIONING_ERRORS.PROVIDER_REQUEST_FAILED,
        `Pomelo ${wallet} provisioning failed`,
        { cardExternalId: card.externalId, status },
      );
    }
    return data;
  }
}
