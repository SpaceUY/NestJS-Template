import { DynamicModule, Global, Module } from '@nestjs/common';
import { Cluster, Redis } from 'ioredis';
import { CacheService } from './redis.cache.service';

interface RedisCacheModuleOptions {
  protocol: 'redis' | 'rediss';
  password?: string;
  host: string;
  port: number;
  clusterMode?: boolean;
  reconnectionDelayMs?: number;
  reconnectionMaxRetries?: number;
}

interface RedisCacheModuleAsyncOptions {
  useFactory: (
    ...args: any[]
  ) => Promise<RedisCacheModuleOptions> | RedisCacheModuleOptions;
  inject?: any[];
}

export type RedisClient = Redis | Cluster;
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
        dnsLookup: (address, callback) => callback(null, address),
        redisOptions: {
          password,
          tls: {},
          ...commonOptions,
        },
      }) as RedisClient;
    }

    const redisUrl = `${protocol}://:${password}@${host}:${port}`;
    return new Redis(redisUrl, commonOptions) as RedisClient;
  }

  /**
   * Creates a Redis client based on the provided configuration.
   * Use this for sync configuration (i.e. when the config is available at module load time).
   */
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
   * Creates a Redis client based on the provided configuration.
   * Use this for async configuration (i.e. when the config is not available at module load time).
   * For example, this is useful when using the `ConfigModule`, and when the config is provided via injection.
   */
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
