import { CacheService } from '../redis.cache.service';

const mockRedisService = { getOrThrow: jest.fn() };

export class MockRedisCacheService extends CacheService {
  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super(mockRedisService as any, {} as any);
  }

  public get = jest.fn();
  public set = jest.fn();
  public remove = jest.fn();
  public clear = jest.fn();
}
