import {
  DynamicModule,
  InjectionToken,
  Module,
  Provider,
} from '@nestjs/common';

import { CACHE_ADAPTER_CLIENT, CACHE_LOGGER } from './cache.tokens';
import { CacheKeysExtension } from './extensions/cache-keys.extension';
import { CacheListExtension } from './extensions/cache-list.extension';
import { CacheService } from './cache.service';
import {
  CacheExtensionOptions,
  CacheModuleAsyncOptions,
  CacheModuleOptions,
  ExtensionProviders,
} from './cache.interfaces';

/**
 * Builds NestJS `providers` and `exports` arrays for the requested cache extensions.
 *
 * To add a new extension type, add a field to `CacheExtensionOptions` and a corresponding `if` block here.
 * @param {CacheExtensionOptions} - The extensions to process.
 * @returns {ExtensionProviders} - The providers and exports to add to the module definition.
 */
function buildExtensionProviders(
  extensions: CacheExtensionOptions,
): ExtensionProviders {
  const providers: Provider[] = [];
  const exports: InjectionToken[] = [];

  if (extensions.list) {
    providers.push({ provide: CacheListExtension, useClass: extensions.list });
    exports.push(CacheListExtension);
  }
  if (extensions.keys) {
    providers.push({ provide: CacheKeysExtension, useClass: extensions.keys });
    exports.push(CacheKeysExtension);
  }

  return { providers, exports };
}

@Module({})
export class CacheAbstractModule {
  static forRoot(options: CacheModuleOptions): DynamicModule {
    const { providers: extProviders, exports: extExports } =
      buildExtensionProviders(options.extensions ?? {});

    const providers: Provider[] = [
      { provide: CacheService, useClass: options.adapter },
    ];
    const exports: InjectionToken[] = [CacheService];

    if (extProviders.length > 0) {
      providers.push(
        {
          provide: CACHE_ADAPTER_CLIENT,
          useFactory: (svc: CacheService) => svc.client,
          inject: [CacheService],
        },
        {
          provide: CACHE_LOGGER,
          useFactory: (svc: CacheService) => svc.logger,
          inject: [CacheService],
        },
        ...extProviders,
      );
      exports.push(...extExports);
    }

    return {
      module: CacheAbstractModule,
      global: options.isGlobal ?? false,
      providers,
      exports,
    };
  }

  static forRootAsync(options: CacheModuleAsyncOptions): DynamicModule {
    const { providers: extProviders, exports: extExports } =
      buildExtensionProviders(options.extensions ?? {});

    const providers: Provider[] = [
      {
        provide: CacheService,
        useFactory: options.useFactory,
        inject: options.inject ?? [],
      },
    ];

    if (extProviders.length > 0) {
      providers.push(
        {
          provide: CACHE_ADAPTER_CLIENT,
          useFactory: (svc: CacheService) => svc.client,
          inject: [CacheService],
        },
        {
          provide: CACHE_LOGGER,
          useFactory: (svc: CacheService) => svc.logger,
          inject: [CacheService],
        },
        ...extProviders,
      );
    }

    return {
      module: CacheAbstractModule,
      global: options.isGlobal ?? false,
      imports: options.imports ?? [],
      providers,
      exports: [CacheService, ...extExports],
    };
  }
}
