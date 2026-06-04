import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigProviderService } from '../abstract/config-provider.service';

@Injectable()
export class EnvConfigAdapter extends ConfigProviderService {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async get(key: string): Promise<string | undefined> {
    return this.configService.get<string>(key);
  }

  async getOrThrow(key: string): Promise<string> {
    return this.configService.getOrThrow<string>(key);
  }
}
