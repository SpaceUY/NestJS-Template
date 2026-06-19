import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { Injectable } from '@nestjs/common';
import { ConfigProviderError, CONFIG_PROVIDER_ERRORS } from '../abstract/config-provider.error';
import { ReloadableConfigProviderService } from '../abstract/reloadable-config-provider.service';
import { SecretsManagerAdapterOptions } from './secrets-manager-config.interfaces';

@Injectable()
export class SecretsManagerConfigAdapter extends ReloadableConfigProviderService {
  private readonly client: SecretsManagerClient;
  private cachedSecret: Record<string, string> | null = null;

  constructor(private readonly options: SecretsManagerAdapterOptions) {
    super();

    // 💡 Important note: it is strongly recommended to use **IAM roles** as the preferred
    // access pattern to AWS services (in this case, the Secrets Manager).
    //
    // When using roles, the access key ID and secret access key are not needed. However, this is
    // left open as an alternative authentication method for border cases like locally connecting to
    // an AWS account. But for remote environments running this code, prefer **roles** unless there's a
    // GOOD REASON not to do so.
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

  /**
   * Fetches secret from secrets manager if not present in the cache.
   * @returns {Promise<Record<string, string>>} - The fetched and parsed secret.
   */
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
      throw new ConfigProviderError(
        CONFIG_PROVIDER_ERRORS.SECRET_FETCH_FAILED,
        `Failed to fetch secret "${this.options.secretName}"`,
        {
          secretName: this.options.secretName,
          cause: (error as Error).message,
        },
      );
    }

    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(secretString);
    } catch (e) {
      throw new ConfigProviderError(
        CONFIG_PROVIDER_ERRORS.SECRET_FETCH_FAILED,
        `Secret "${this.options.secretName}" is not valid JSON`,
        { secretName: this.options.secretName, cause: (e as Error).message },
      );
    }

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
      throw new ConfigProviderError(
        CONFIG_PROVIDER_ERRORS.KEY_NOT_FOUND,
        `Key "${key}" not found in secret "${this.options.secretName}"`,
        { key, secretName: this.options.secretName },
      );
    }
    return value;
  }

  async reload(): Promise<void> {
    this.cachedSecret = null;
    await this._fetchSecret();
    await this.notifyReload();
  }
}
