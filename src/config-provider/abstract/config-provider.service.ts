export abstract class ConfigProviderService {
  abstract get(key: string): Promise<string | undefined>;
  abstract getOrThrow(key: string): Promise<string>;
}
