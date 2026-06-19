import { InjectionToken, ModuleMetadata } from '@nestjs/common';
import { ConfigProviderService } from './config-provider.service';

export interface ConfigScopeFieldMapping {
  source: string;
  key: string;
}

export interface ConfigScopeDefinition<T> {
  KEY: string;
  name: string;
  fields: Record<string, ConfigScopeFieldMapping>;
  validate?: (raw: Record<string, unknown>) => T;
  live?: boolean;
}

export interface ConfigProviderSourceSync {
  // forRoot instantiates the adapter directly (no NestJS DI). Adapters that
  // need constructor arguments must use forRootAsync instead.
  useClass?: new () => ConfigProviderService;
  useValue?: ConfigProviderService;
}

export interface ConfigProviderModuleOptions {
  isGlobal?: boolean;
  sources: Record<string, ConfigProviderSourceSync>;
  scopes?: ConfigScopeDefinition<Record<string, unknown>>[];
}

export interface ConfigProviderSourceAsync {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => Promise<ConfigProviderService> | ConfigProviderService;
}

export interface ConfigProviderModuleAsyncOptions {
  isGlobal?: boolean;
  sources: Record<string, ConfigProviderSourceAsync>;
  scopes?: ConfigScopeDefinition<Record<string, unknown>>[];
}
