export abstract class CacheService {
  abstract get(key: string): Promise<string | null>;
  abstract set(key: string, value: string | number, ttl?: number): Promise<void>;
  abstract del(...keys: string[]): Promise<void>;
  abstract clear(): Promise<void>;
}
