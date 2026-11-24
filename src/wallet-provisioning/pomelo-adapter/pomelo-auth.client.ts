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

// Used when Pomelo's response carries no usable expires_in: short, so a revoked token is dropped soon.
const DEFAULT_LIFETIME_MS = 5 * 60_000;

// Renew a little before Pomelo's expiry so a token never dies mid-request.
const EXPIRY_MARGIN_MS = 60_000;

/** Pomelo's client-credentials token, cached in memory per instance. */
@Injectable()
export class PomeloAuthClient {
  private cached: { token: string; expiresAt: number } | null = null;
  // Concurrent callers share one token call instead of each asking Pomelo for a new token.
  private inFlight: Promise<string> | null = null;

  constructor(
    @Inject(pomeloTokenizationScope.KEY)
    private readonly config: PomeloTokenizationScopeConfig,
  ) {}

  /** `timeoutMs`: what is left of the caller's budget; defaults to the whole request timeout. */
  async getToken(
    timeoutMs: number = this.config.requestTimeoutMs,
  ): Promise<string> {
    if (this.cached && Date.now() < this.cached.expiresAt) {
      return this.cached.token;
    }
    this.inFlight ??= this.fetchToken(timeoutMs).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  invalidate(): void {
    this.cached = null;
  }

  private async fetchToken(timeoutMs: number): Promise<string> {
    const { status, body } = await postJson(
      `${this.config.baseUrl}/oauth/token`,
      {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        audience: this.config.audience,
        grant_type: 'client_credentials',
      },
      {},
      timeoutMs,
    );
    const token = body as Partial<PomeloTokenResponse> | null;
    if (!isSuccess(status) || !token?.access_token) {
      throw new WalletProvisioningError(
        WALLET_PROVISIONING_ERRORS.PROVIDER_AUTH_FAILED,
        'Pomelo rejected the client credentials',
        { status },
      );
    }
    const expiresIn = Number(token.expires_in);
    const lifetimeMs =
      Number.isFinite(expiresIn) && expiresIn > 0
        ? expiresIn * 1000
        : DEFAULT_LIFETIME_MS;
    this.cached = {
      token: token.access_token,
      expiresAt: Date.now() + lifetimeMs - EXPIRY_MARGIN_MS,
    };
    return token.access_token;
  }
}
