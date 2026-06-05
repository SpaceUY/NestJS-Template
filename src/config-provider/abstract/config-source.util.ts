import { ConfigScopeFieldMapping } from './config-provider.interfaces';

export const SOURCES = {
  ENVIRONMENT: 'env',
  AWS_SECRETS_MANAGER: 'sm',
} as const;

export const configSources = {
  env: (key: string): ConfigScopeFieldMapping => ({
    source: SOURCES.ENVIRONMENT,
    key,
  }),
  sm: (key: string): ConfigScopeFieldMapping => ({
    source: SOURCES.AWS_SECRETS_MANAGER,
    key,
  }),
  from:
    (sourceName: string) =>
    (key: string): ConfigScopeFieldMapping => ({ source: sourceName, key }),
};
