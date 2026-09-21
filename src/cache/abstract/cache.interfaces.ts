import { InjectionToken, ModuleMetadata, Provider, Type } from '@nestjs/common';

import { CacheKeysExtension } from './extensions/cache-keys.extension';
import { CacheListExtension } from './extensions/cache-list.extension';
import { CacheService } from './cache.service';

export interface CacheExtensionOptions {
  list?: Type<CacheListExtension>;
  keys?: Type<CacheKeysExtension>;
}

export interface CacheModuleOptions {
  adapter: Type<CacheService>;
  isGlobal?: boolean;
  extensions?: CacheExtensionOptions;
}

// `TArgs` is the tuple of values the `inject` tokens resolve to. It is inferred
// from the factory at the call site, which is what keeps a typed factory —
// `(config: SomeScopeConfig) => ...` — assignable here. A plain `unknown[]`
// would reject it: function parameters are contravariant.
export interface CacheModuleAsyncOptions<TArgs extends unknown[] = unknown[]> {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (...args: TArgs) => Promise<CacheService> | CacheService;
  isGlobal?: boolean;
  extensions?: CacheExtensionOptions;
}

export interface ExtensionProviders {
  providers: Provider[];
  exports: InjectionToken[];
}
