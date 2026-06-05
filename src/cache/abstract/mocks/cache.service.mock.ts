import { CacheService } from '../cache.service';

export class MockCacheService extends CacheService {
  readonly client = null;
  get = jest.fn().mockResolvedValue(null);
  set = jest.fn().mockResolvedValue(undefined);
  del = jest.fn().mockResolvedValue(undefined);
  clear = jest.fn().mockResolvedValue(undefined);
}
