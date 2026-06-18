import { Cluster, Redis } from 'ioredis';

import {
  ClusterRedisAdapterConfig,
  RedisAdapterConfig,
} from './redis-adapter-config.interface';
import { StandardLogger } from './utils/logger';

export function createRedisClient(config: RedisAdapterConfig): Redis | Cluster {
  const {
    clusterMode = false,
    protocol,
    password,
    host,
    port,
    reconnectionDelayMs = 5000,
    reconnectionMaxRetries = 10,
  } = config;

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

  const retryStrategy = (times: number) => {
    if (times < reconnectionMaxRetries) return reconnectionDelayMs;
    return null;
  };

  const redisUrl = `${protocol}://:${password}@${host}:${port}`;
  return new Redis(redisUrl, { retryStrategy });
}

export async function verifyConnection(
  redis: Redis | Cluster,
  logger: StandardLogger,
): Promise<void> {
  const TIMEOUT_MS = 5000;
  const testKey = `redis-startup-test-${Date.now()}`;
  const testValue = 'connection-test';

  try {
    await Promise.race([
      testRedisOperations(redis, logger, testKey, testValue),
      createTimeoutPromise(TIMEOUT_MS),
    ]);
  } catch (error) {
    logger.error({
      message: '❌ Redis connection failed:',
      data: { error: error.message },
    });
    logger.error({
      message: '🚨 STOPPING APPLICATION - Redis is required for operation',
    });
    process.exit(1);
  }
}

async function testRedisOperations(
  redis: Redis | Cluster,
  logger: StandardLogger,
  testKey: string,
  testValue: string,
): Promise<void> {
  const startTime = Date.now();
  await redis.set(testKey, testValue);
  const retrievedValue = await redis.get(testKey);
  if (retrievedValue !== testValue) {
    throw new Error(
      `Redis read/write test failed. Expected: ${testValue}, Got: ${retrievedValue}`,
    );
  }
  await redis.del(testKey);
  logger.info({
    message: '✅ Redis connection verified',
    data: { responseTimeMs: Date.now() - startTime },
  });
}

function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Redis connection timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}
