import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
  Provider,
  Type,
} from '@nestjs/common';

import { CACHE_ADAPTER_CLIENT } from './cache.tokens';
import { CacheKeysExtension } from './extensions/cache-keys.extension';
import { CacheListExtension } from './extensions/cache-list.extension';
import { CacheService } from './cache.service';

const CACHE_ADAPTER_BUNDLE = 'CACHE_ADAPTER_BUNDLE';

export interface CacheAdapterBundle<TClient = unknown> {
  service: CacheService;
  client: TClient;
}

interface CacheExtensionOptions {
  list?: Type<CacheListExtension>;
  keys?: Type<CacheKeysExtension>;
}

interface CacheModuleOptions {
  adapter: Type<CacheService>;
  isGlobal?: boolean;
  extensions?: CacheExtensionOptions;
}

interface CacheModuleAsyncOptions<TClient = unknown> {
  imports?: ModuleMetadata['imports'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inject?: any[];
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => Promise<CacheAdapterBundle<TClient>> | CacheAdapterBundle<TClient>;
  isGlobal?: boolean;
  extensions?: CacheExtensionOptions;
}

@Module({})
export class CacheAbstractModule {
  static forRoot(options: CacheModuleOptions): DynamicModule {
    const { extensions = {} } = options;

    const providers: Provider[] = [
      { provide: CacheService, useClass: options.adapter },
    ];
    const exports: InjectionToken[] = [CacheService];

    if (extensions.list || extensions.keys) {
      providers.push({
        provide: CACHE_ADAPTER_CLIENT,
        useFactory: (svc: CacheService) => svc.client,
        inject: [CacheService],
      });
    }

    if (extensions.list) {
      providers.push({ provide: CacheListExtension, useClass: extensions.list });
      exports.push(CacheListExtension);
    }
    if (extensions.keys) {
      providers.push({ provide: CacheKeysExtension, useClass: extensions.keys });
      exports.push(CacheKeysExtension);
    }

    return {
      module: CacheAbstractModule,
      global: options.isGlobal ?? false,
      providers,
      exports,
    };
  }

  static forRootAsync<TClient = unknown>(
    options: CacheModuleAsyncOptions<TClient>,
  ): DynamicModule {
    const { extensions = {} } = options;

    const providers: Provider[] = [
      {
        provide: CACHE_ADAPTER_BUNDLE,
        useFactory: options.useFactory,
        inject: options.inject ?? [],
      },
      {
        provide: CacheService,
        useFactory: (b: CacheAdapterBundle) => b.service,
        inject: [CACHE_ADAPTER_BUNDLE],
      },
      {
        provide: CACHE_ADAPTER_CLIENT,
        useFactory: (b: CacheAdapterBundle) => b.client,
        inject: [CACHE_ADAPTER_BUNDLE],
      },
    ];

    const exports: InjectionToken[] = [CacheService];

    if (extensions.list) {
      providers.push({ provide: CacheListExtension, useClass: extensions.list });
      exports.push(CacheListExtension);
    }
    if (extensions.keys) {
      providers.push({ provide: CacheKeysExtension, useClass: extensions.keys });
      exports.push(CacheKeysExtension);
    }

    return {
      module: CacheAbstractModule,
      global: options.isGlobal ?? false,
      imports: options.imports ?? [],
      providers,
      exports,
    };
  }
}
