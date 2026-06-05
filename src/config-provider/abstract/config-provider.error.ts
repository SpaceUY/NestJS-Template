import { CONFIG_PROVIDER_ERRORS } from './config-provider-error-codes';

export type ConfigProviderErrorCode = typeof CONFIG_PROVIDER_ERRORS[keyof typeof CONFIG_PROVIDER_ERRORS];

export class ConfigProviderError extends Error {
  constructor(
    public readonly code: ConfigProviderErrorCode,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ConfigProviderError';
  }
}
