export interface SecretsManagerAdapterOptions {
  secretName: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  cacheSecret?: boolean;
}
