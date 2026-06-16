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

export interface CacheModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inject?: any[];
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => Promise<CacheService> | CacheService;
  isGlobal?: boolean;
  extensions?: CacheExtensionOptions;
}

export interface ExtensionProviders {
  providers: Provider[];
  exports: InjectionToken[];
}
