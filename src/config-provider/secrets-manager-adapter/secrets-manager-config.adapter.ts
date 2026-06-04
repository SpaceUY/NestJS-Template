import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { CONFIG_PROVIDER_ERRORS } from '../abstract/config-provider-error-codes';
import { ConfigProviderService } from '../abstract/config-provider.service';
import { SecretsManagerAdapterOptions } from './secrets-manager-config.interfaces';

export class SecretsManagerConfigAdapter extends ConfigProviderService {
  private readonly client: SecretsManagerClient;
  private cachedSecret: Record<string, string> | null = null;

  constructor(private readonly options: SecretsManagerAdapterOptions) {
    super();
    const credentials =
      options.accessKeyId && options.secretAccessKey
        ? {
            credentials: {
              accessKeyId: options.accessKeyId,
              secretAccessKey: options.secretAccessKey,
            },
          }
        : {};
    this.client = new SecretsManagerClient({
      region: options.region,
      ...credentials,
    });
  }

  private async _fetchSecret(): Promise<Record<string, string>> {
    if (this.options.cacheSecret !== false && this.cachedSecret) {
      return this.cachedSecret;
    }

    let secretString: string;
    try {
      const response = await this.client.send(
        new GetSecretValueCommand({ SecretId: this.options.secretName }),
      );
      secretString = response.SecretString ?? '{}';
    } catch (error) {
      throw new Error(
        `[${CONFIG_PROVIDER_ERRORS.SECRET_FETCH_FAILED}] Failed to fetch secret "${this.options.secretName}": ${(error as Error).message}`,
      );
    }

    const parsed: Record<string, string> = JSON.parse(secretString);

    if (this.options.cacheSecret !== false) {
      this.cachedSecret = parsed;
    }

    return parsed;
  }

  async get(key: string): Promise<string | undefined> {
    const secret = await this._fetchSecret();
    return secret[key];
  }

  async getOrThrow(key: string): Promise<string> {
    const value = await this.get(key);
    if (value === undefined) {
      throw new Error(
        `[${CONFIG_PROVIDER_ERRORS.KEY_NOT_FOUND}] Key "${key}" not found in secret "${this.options.secretName}"`,
      );
    }
    return value;
  }
}
