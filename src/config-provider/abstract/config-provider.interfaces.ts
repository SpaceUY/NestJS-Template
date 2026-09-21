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
  // forRoot instantiates the adapter directly (no NestJS DI) so the module can
  // hand it the container's logger. Adapters that need constructor arguments
  // must use a source with `useFactory` instead.
  useClass?: new () => ConfigProviderService;
  useValue?: ConfigProviderService;
}

export interface ConfigProviderModuleOptions {
  isGlobal?: boolean;
  sources: Record<string, ConfigProviderSourceSync>;
  scopes?: ConfigScopeDefinition<Record<string, unknown>>[];
}

// The factory's arguments are the values its `inject` tokens resolve to, which
// this interface cannot know. Sources are declared inside a `Record`, so there
// is no call site for a type parameter to be inferred from — unlike the other
// abstract modules, which take `<TArgs extends unknown[]>` on `forRootAsync`.
// `never[]` is what keeps a typed factory — `(config: SomeScopeConfig) => ...`
// — assignable: parameters are contravariant, so `never` accepts any parameter
// type, where `unknown[]` would accept none. The module widens it back at the
// one place that calls it.
export interface ConfigProviderSourceAsync {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (
    ...args: never[]
  ) => Promise<ConfigProviderService> | ConfigProviderService;
}

export interface ConfigProviderModuleAsyncOptions {
  isGlobal?: boolean;
  sources: Record<string, ConfigProviderSourceAsync>;
  scopes?: ConfigScopeDefinition<Record<string, unknown>>[];
}
