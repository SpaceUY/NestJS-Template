import { DynamicModule, Global, Module } from '@nestjs/common';
import { Cluster, Redis, RedisOptions } from 'ioredis';
import { CacheService } from './redis.cache.service';

interface RedisClusterOptions {
  scaleReads?: 'master' | 'slave' | 'all';
  maxRedirections?: number;
  retryDelayOnFailover?: number;
  dnsLookup?: (
    address: string,
    callback: (err: Error | null, address: string) => void,
  ) => void;
  redisOptions?: Omit<
    RedisOptions,
    | 'port'
    | 'host'
    | 'path'
    | 'sentinels'
    | 'retryStrategy'
    | 'enableOfflineQueue'
    | 'readOnly'
  >;
}

/**
 * Base options that are common to both modes
 */
interface BaseRedisCacheModuleOptions {
  protocol: 'redis' | 'rediss';
  password?: string;
  host: string;
  port: number;
  reconnectionDelayMs?: number;
  reconnectionMaxRetries?: number;
}

/**
 * Standalone mode options
 */
interface StandaloneRedisCacheModuleOptions
  extends BaseRedisCacheModuleOptions {
  clusterMode?: false | undefined;
  clusterOptions?: never;
}

/**
 * Cluster mode options
 */
interface ClusterRedisCacheModuleOptions extends BaseRedisCacheModuleOptions {
  clusterMode: true;
  clusterOptions?: RedisClusterOptions;
}

/**
 * Redis cache module options as a union of standalone and cluster mode options
 */
type RedisCacheModuleOptions =
  | StandaloneRedisCacheModuleOptions
  | ClusterRedisCacheModuleOptions;

type AsyncFactoryFn<T> = (...args: any[]) => Promise<T> | T;

interface BaseAsyncOptions {
  inject?: any[];
}

/**
 * Standalone async options
 */
interface StandaloneAsyncOptions extends BaseAsyncOptions {
  useFactory: AsyncFactoryFn<StandaloneRedisCacheModuleOptions>;
}

/**
 * Cluster async options
 */
interface ClusterAsyncOptions extends BaseAsyncOptions {
  useFactory: AsyncFactoryFn<ClusterRedisCacheModuleOptions>;
}

/**
 * Redis cache module async options as a union of standalone and cluster mode async options
 */
type RedisCacheModuleAsyncOptions =
  | StandaloneAsyncOptions
  | ClusterAsyncOptions;

/**
 * Redis client type. Abstract away the underlying implementation
 */
export type RedisClient = Redis | Cluster;

/**
 * Redis client token
 */
export const REDIS_CLIENT = 'REDIS_CLIENT_TOKEN';

/**
 * CacheModule
 *
 * A simple wrapper for the `RedisModule` or `ClusterModule` instantiation.
 * Both of those are global by default.
 */
@Global()
@Module({})
export class RedisCacheModule {
  /**
   * Creates a Redis client based on the provided configuration
   * @param {RedisCacheModuleOptions} config - The configuration for the Redis client
   * @returns {RedisClient} A Redis client instance
   */
  private static createRedisClient(
    config: RedisCacheModuleOptions,
  ): RedisClient {
    const {
      clusterMode = false,
      protocol,
      password,
      host,
      port,
      reconnectionDelayMs = 5000,
      reconnectionMaxRetries = 10,
      clusterOptions = {},
    } = config;

    const commonOptions = {
      retryStrategy: (times: number) => {
        // Retry after `reconnectionDelayMs` milliseconds, with a maximum of `reconnectionMaxRetries` retries
        if (times < reconnectionMaxRetries) {
          return reconnectionDelayMs;
        }
        // Stop retrying after `reconnectionMaxRetries` attempts
        return null;
      },
    };

    if (clusterMode) {
      // This is specially tailored for AWS ElastiCache
      // https://github.com/redis/ioredis?tab=readme-ov-file#special-note-aws-elasticache-clusters-with-tls
      return new Cluster([{ host, port }], {
        dnsLookup:
          clusterOptions.dnsLookup ||
          ((address, callback) => callback(null, address)),
        scaleReads: clusterOptions.scaleReads || 'master',
        maxRedirections: clusterOptions.maxRedirections || 16,
        redisOptions: clusterOptions.redisOptions,
      }) as RedisClient;
    }

    const redisUrl = `${protocol}://:${password}@${host}:${port}`;
    return new Redis(redisUrl, commonOptions) as RedisClient;
  }

  /**
   * Create a Redis client with pre-configured options
   * @param {RedisCacheModuleOptions} options - The configuration for the Redis cache module
   * @returns {DynamicModule} The dynamic module for the Redis cache module
   */
  static forRoot(options: StandaloneRedisCacheModuleOptions): DynamicModule; // Overload for standalone mode
  static forRoot(options: ClusterRedisCacheModuleOptions): DynamicModule; // Overload for cluster mode
  static forRoot(options: RedisCacheModuleOptions): DynamicModule {
    return {
      module: RedisCacheModule,
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: () => RedisCacheModule.createRedisClient(options),
        },
        CacheService,
      ],
      exports: [CacheService, REDIS_CLIENT],
    };
  }

  /**
   * Create a Redis client with pre-configured options
   * @param {RedisCacheModuleAsyncOptions} options - The configuration for the Redis cache module
   * @returns {DynamicModule} The dynamic module for the Redis cache module
   */
  static forRootAsync(options: StandaloneAsyncOptions): DynamicModule; // Overload for standalone mode async
  static forRootAsync(options: ClusterAsyncOptions): DynamicModule; // Overload for cluster mode async
  static forRootAsync(options: RedisCacheModuleAsyncOptions): DynamicModule {
    return {
      module: RedisCacheModule,
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: async (...args: any[]) => {
            const config = await options.useFactory(...args);
            return RedisCacheModule.createRedisClient(config);
          },
          inject: options.inject || [],
        },
        CacheService,
      ],
      exports: [CacheService, REDIS_CLIENT],
    };
  }
}
