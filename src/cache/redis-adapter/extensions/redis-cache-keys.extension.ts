import { Inject, Injectable } from '@nestjs/common';
import { Cluster, Redis } from 'ioredis';

import { CacheKeysExtension } from '../../abstract/extensions/cache-keys.extension';
import { CACHE_ADAPTER_CLIENT } from '../../abstract/cache.tokens';

@Injectable()
export class RedisCacheKeysExtension extends CacheKeysExtension {
  constructor(
    @Inject(CACHE_ADAPTER_CLIENT) private readonly _redis: Redis | Cluster,
  ) {
    super();
  }

  async keys(pattern: string): Promise<string[]> {
    return this._redis.keys(pattern);
  }
}
