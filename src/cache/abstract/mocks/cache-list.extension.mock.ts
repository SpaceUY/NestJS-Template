import { CacheListExtension } from '../extensions/cache-list.extension';

export class MockCacheListExtension extends CacheListExtension {
  lpush = jest.fn().mockResolvedValue(0);
  rpush = jest.fn().mockResolvedValue(0);
  lpop = jest.fn().mockResolvedValue(null);
  rpop = jest.fn().mockResolvedValue(null);
  lrange = jest.fn().mockResolvedValue([]);
  llen = jest.fn().mockResolvedValue(0);
  lrem = jest.fn().mockResolvedValue(0);
}
