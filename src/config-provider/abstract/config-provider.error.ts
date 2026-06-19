export const CONFIG_PROVIDER_ERRORS = {
  KEY_NOT_FOUND: 'CONFIG_PROVIDER_KEY_NOT_FOUND',
  SCOPE_VALIDATION_FAILED: 'CONFIG_PROVIDER_SCOPE_VALIDATION_FAILED',
  SECRET_FETCH_FAILED: 'CONFIG_PROVIDER_SECRET_FETCH_FAILED',
  UNKNOWN_SOURCE: 'CONFIG_PROVIDER_UNKNOWN_SOURCE',
  DUPLICATE_SCOPE_KEY: 'CONFIG_PROVIDER_DUPLICATE_SCOPE_KEY',
  RELOAD_FAILED: 'CONFIG_PROVIDER_RELOAD_FAILED',
} as const;

export type ConfigProviderErrorCode =
  (typeof CONFIG_PROVIDER_ERRORS)[keyof typeof CONFIG_PROVIDER_ERRORS];

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
