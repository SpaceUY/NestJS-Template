import {
  DynamicModule,
  ForwardReference,
  Module,
  Type,
} from '@nestjs/common';

import { CacheKeysExtension } from './extensions/cache-keys.extension';
import { CacheListExtension } from './extensions/cache-list.extension';
import { CacheService } from './cache.service';
import { CACHE_PROVIDER } from './cache.tokens';

type AdapterModule =
  | Type<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  | DynamicModule
  | Promise<DynamicModule>
  | ForwardReference;

type ExtensionToken = typeof CacheListExtension | typeof CacheKeysExtension;

interface CacheModuleOptions {
  adapter: AdapterModule;
  isGlobal?: boolean;
  extensions?: ExtensionToken[];
}

@Module({})
export class CacheAbstractModule {
  static forRoot(options: CacheModuleOptions): DynamicModule {
    const { adapter, isGlobal = false, extensions = [] } = options;

    return {
      module: CacheAbstractModule,
      global: isGlobal,
      imports: [adapter],
      providers: [
        {
          provide: CacheService,
          useFactory: (provider: CacheService) => provider,
          inject: [CACHE_PROVIDER],
        },
      ],
      exports: [CacheService, ...extensions],
    };
  }
}
