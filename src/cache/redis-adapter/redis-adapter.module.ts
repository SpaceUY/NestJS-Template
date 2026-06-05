import {
  DynamicModule,
  InjectionToken,
  Logger,
  Module,
  ModuleMetadata,
  Provider,
} from '@nestjs/common';
import { Cluster, Redis } from 'ioredis';

import { CacheKeysExtension } from '../abstract/extensions/cache-keys.extension';
import { CacheListExtension } from '../abstract/extensions/cache-list.extension';
import {
  CACHE_ADAPTER_CLIENT,
  CACHE_PROVIDER,
  REDIS_ADAPTER_LOGGER_TOKEN,
} from '../abstract/cache.tokens';
import {
  ClusterRedisAdapterConfig,
  RedisAdapterConfig,
  StandaloneRedisAdapterConfig,
} from './redis-adapter-config.interface';
import { RedisCacheKeysExtension } from './extensions/redis-cache-keys.extension';
import { RedisCacheListExtension } from './extensions/redis-cache-list.extension';
import { RedisCacheAdapterService } from './redis-adapter.service';
import { StandardLogger, adaptLogger } from './utils/logger';

interface RedisAdapterExtensionsOptions {
  list?: boolean;
  keys?: boolean;
}

interface RedisAdapterModuleOptions {
  config: RedisAdapterConfig;
  extensions?: RedisAdapterExtensionsOptions;
}

interface RedisAdapterModuleAsyncOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inject?: any[];
  imports?: ModuleMetadata['imports'];
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => Promise<RedisAdapterConfig> | RedisAdapterConfig;
  extensions?: RedisAdapterExtensionsOptions;
}

@Module({})
export class RedisAdapterModule {
  private static createRedisClient(config: RedisAdapterConfig): Redis | Cluster {
    const {
      clusterMode = false,
      protocol,
      password,
      host,
      port,
      reconnectionDelayMs = 5000,
      reconnectionMaxRetries = 10,
    } = config;

    const retryStrategy = (times: number) => {
      if (times < reconnectionMaxRetries) return reconnectionDelayMs;
      return null;
    };

    if (clusterMode) {
      const { clusterOptions = {} } = config as ClusterRedisAdapterConfig;
      return new Cluster([{ host, port }], {
        dnsLookup:
          clusterOptions.dnsLookup ||
          ((address, callback) => callback(null, address)),
        scaleReads: clusterOptions.scaleReads || 'master',
        maxRedirections: clusterOptions.maxRedirections || 16,
        redisOptions: clusterOptions.redisOptions,
      });
    }

    const redisUrl = `${protocol}://:${password}@${host}:${port}`;
    return new Redis(redisUrl, { retryStrategy });
  }

  private static buildExtensionProviders(
    extensions: RedisAdapterExtensionsOptions = {},
  ): {
    providers: Provider[];
    exports: InjectionToken[];
  } {
    const providers: Provider[] = [];
    const exports: InjectionToken[] = [];

    if (extensions.list) {
      providers.push({ provide: CacheListExtension, useClass: RedisCacheListExtension });
      exports.push(CacheListExtension);
    }
    if (extensions.keys) {
      providers.push({ provide: CacheKeysExtension, useClass: RedisCacheKeysExtension });
      exports.push(CacheKeysExtension);
    }

    return { providers, exports };
  }

  static register(options: RedisAdapterModuleOptions): DynamicModule;
  static register(options: RedisAdapterModuleOptions & { config: StandaloneRedisAdapterConfig }): DynamicModule;
  static register(options: RedisAdapterModuleOptions & { config: ClusterRedisAdapterConfig }): DynamicModule;
  static register(options: RedisAdapterModuleOptions): DynamicModule {
    const { config, extensions } = options;
    const { providers: extProviders, exports: extExports } =
      RedisAdapterModule.buildExtensionProviders(extensions);

    return {
      module: RedisAdapterModule,
      providers: [
        Logger,
        {
          provide: REDIS_ADAPTER_LOGGER_TOKEN,
          inject: [Logger],
          useFactory: (defaultLogger: Logger) => {
            const logger: StandardLogger =
              config.logger ?? adaptLogger(defaultLogger);
            return logger;
          },
        },
        {
          provide: CACHE_ADAPTER_CLIENT,
          useFactory: () => RedisAdapterModule.createRedisClient(config),
        },
        RedisCacheAdapterService,
        { provide: CACHE_PROVIDER, useExisting: RedisCacheAdapterService },
        ...extProviders,
      ],
      exports: [CACHE_ADAPTER_CLIENT, CACHE_PROVIDER, ...extExports],
    };
  }

  static registerAsync(options: RedisAdapterModuleAsyncOptions): DynamicModule {
    const { extensions } = options;
    const { providers: extProviders, exports: extExports } =
      RedisAdapterModule.buildExtensionProviders(extensions);

    return {
      module: RedisAdapterModule,
      imports: options.imports ?? [],
      providers: [
        Logger,
        {
          provide: REDIS_ADAPTER_LOGGER_TOKEN,
          inject: [Logger],
          useFactory: (defaultLogger: Logger) => adaptLogger(defaultLogger),
        },
        {
          provide: CACHE_ADAPTER_CLIENT,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          useFactory: async (...args: any[]) => {
            const config = await options.useFactory(...args);
            return RedisAdapterModule.createRedisClient(config);
          },
          inject: options.inject ?? [],
        },
        RedisCacheAdapterService,
        { provide: CACHE_PROVIDER, useExisting: RedisCacheAdapterService },
        ...extProviders,
      ],
      exports: [CACHE_ADAPTER_CLIENT, CACHE_PROVIDER, ...extExports],
    };
  }
}
