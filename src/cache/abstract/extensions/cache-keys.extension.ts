export abstract class CacheKeysExtension {
  abstract keys(pattern: string): Promise<string[]>;
}
