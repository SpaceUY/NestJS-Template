import { Inject, Injectable } from '@nestjs/common';
import { Cluster, Redis } from 'ioredis';

import { CacheError, CACHE_ERRORS } from '../../abstract/cache.error';
import { CacheKeysExtension } from '../../abstract/extensions/cache-keys.extension';
import { CACHE_ADAPTER_CLIENT, CACHE_LOGGER } from '../../abstract/cache.tokens';
import { StandardLogger } from '../utils/logger';

@Injectable()
export class RedisCacheKeysExtension extends CacheKeysExtension {
  constructor(
    @Inject(CACHE_ADAPTER_CLIENT) private readonly _redis: Redis | Cluster,
    @Inject(CACHE_LOGGER) private readonly _logger: StandardLogger,
  ) {
    super();
  }

  async keys(pattern: string): Promise<string[]> {
    this._logger.debug({ message: 'Fetching keys matching pattern from cache', data: { pattern } });
    try {
      return await this._redis.keys(pattern);
    } catch {
      throw new CacheError(CACHE_ERRORS.KEYS_FAILED, 'Cache keys failed', { pattern });
    }
  }
}
