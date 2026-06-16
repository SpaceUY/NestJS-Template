import type { RedisOptions } from 'ioredis';

import type { StandardLogger } from './utils/logger';

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

interface BaseRedisAdapterConfig {
  protocol: 'redis' | 'rediss';
  password?: string;
  host: string;
  port: number;
  reconnectionDelayMs?: number;
  reconnectionMaxRetries?: number;
  logger?: StandardLogger;
}

export interface StandaloneRedisAdapterConfig extends BaseRedisAdapterConfig {
  clusterMode?: false | undefined;
  clusterOptions?: never;
}

export interface ClusterRedisAdapterConfig extends BaseRedisAdapterConfig {
  clusterMode: true;
  clusterOptions?: RedisClusterOptions;
}

export type RedisAdapterConfig =
  | StandaloneRedisAdapterConfig
  | ClusterRedisAdapterConfig;
