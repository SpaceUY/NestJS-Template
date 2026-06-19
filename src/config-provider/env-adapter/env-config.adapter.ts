import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { ConfigProviderService } from '../abstract/config-provider.service';
import { ConfigProviderError, CONFIG_PROVIDER_ERRORS } from '../abstract/config-provider.error';
import { EnvConfigAdapterOptions } from './env-config.interfaces';

@Injectable()
export class EnvConfigAdapter extends ConfigProviderService {
  private readonly env: Record<string, string>;

  constructor(options: EnvConfigAdapterOptions = {}) {
    super();
    this.env = this._load(options.envFilePath);
  }

  private _load(
    envFilePath: string | string[] | undefined,
  ): Record<string, string> {
    const merged: Record<string, string> = { ...process.env } as Record<
      string,
      string
    >;

    if (!envFilePath) return merged;

    const paths = Array.isArray(envFilePath) ? envFilePath : [envFilePath];

    for (const filePath of paths) {
      if (!fs.existsSync(filePath)) continue;
      const parsed = dotenv.parse(fs.readFileSync(filePath));
      Object.assign(merged, parsed);
    }

    return merged;
  }

  async get(key: string): Promise<string | undefined> {
    return this.env[key];
  }

  async getOrThrow(key: string): Promise<string> {
    const value = this.env[key];
    if (value === undefined) {
      throw new ConfigProviderError(
        CONFIG_PROVIDER_ERRORS.KEY_NOT_FOUND,
        `Key "${key}" not found in environment`,
        { key },
      );
    }
    return value;
  }
}
