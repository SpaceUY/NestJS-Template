import { CacheKeysExtension } from '../extensions/cache-keys.extension';

export class MockCacheKeysExtension extends CacheKeysExtension {
  keys = jest.fn().mockResolvedValue([]);
}
