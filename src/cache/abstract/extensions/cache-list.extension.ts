export abstract class CacheListExtension {
  abstract lpush(key: string, value: string | string[]): Promise<number>;
  abstract rpush(key: string, value: string | string[]): Promise<number>;
  abstract lpop(key: string): Promise<string | null>;
  abstract rpop(key: string): Promise<string | null>;
  abstract lrange(key: string, start: number, stop: number): Promise<string[]>;
  abstract llen(key: string): Promise<number>;
  abstract lrem(key: string, count: number, value: string): Promise<number>;
}
