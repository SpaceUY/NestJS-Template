import { Inject, Injectable } from '@nestjs/common';
import {
  WALLET_PROVISIONING_ERRORS,
  WalletProvisioningError,
} from '../abstract/wallet-provisioning.error';
import {
  pomeloTokenizationScope,
  PomeloTokenizationScopeConfig,
} from './config/pomelo-tokenization.scope';
import { isSuccess, postJson } from './pomelo-http';
import { PomeloTokenResponse } from './pomelo.types';

// Renew a little before Pomelo's expiry so a token never dies mid-request.
const EXPIRY_MARGIN_MS = 60_000;

/** Pomelo's client-credentials token, cached in memory per instance. */
@Injectable()
export class PomeloAuthClient {
  private cached: { token: string; expiresAt: number } | null = null;

  constructor(
    @Inject(pomeloTokenizationScope.KEY)
    private readonly config: PomeloTokenizationScopeConfig,
  ) {}

  async getToken(): Promise<string> {
    if (this.cached && Date.now() < this.cached.expiresAt) {
      return this.cached.token;
    }
    const { status, body } = await postJson(
      `${this.config.baseUrl}/oauth/token`,
      {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        audience: this.config.audience,
        grant_type: 'client_credentials',
      },
      {},
      this.config.requestTimeoutMs,
    );
    const token = body as Partial<PomeloTokenResponse> | null;
    if (!isSuccess(status) || !token?.access_token) {
      throw new WalletProvisioningError(
        WALLET_PROVISIONING_ERRORS.PROVIDER_AUTH_FAILED,
        'Pomelo rejected the client credentials',
        { status },
      );
    }
    const lifetimeMs = (token.expires_in ?? 0) * 1000;
    this.cached = {
      token: token.access_token,
      expiresAt: Date.now() + lifetimeMs - EXPIRY_MARGIN_MS,
    };
    return token.access_token;
  }

  invalidate(): void {
    this.cached = null;
  }
}
