import { CacheService } from '../redis.cache.service';

const mockRedisService = { getOrThrow: jest.fn() };

export class MockRedisCacheService extends CacheService {
  constructor() {
    super(mockRedisService as any);
  }

  public get = jest.fn();
  public set = jest.fn();
  public remove = jest.fn();
  public clear = jest.fn();
}
