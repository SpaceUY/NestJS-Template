import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { ResendAdapterService } from './resend-adapter.service';
import { ResendAdapterConfig } from './resend-adapter-config.interface';
import { RESEND_ADAPTER_PROVIDER_CONFIG } from './resend-adapter-config-provider.const';
import { EMAIL_PROVIDER } from '../abstract/email-provider.const';
// No template service wiring in mail adapters anymore
import { Logger } from '@nestjs/common';
import { EMAIL_LOGGER } from '../abstract/email-logger.interface';
import { createDefaultEmailLogger } from '../logger/email-logger.adapter';

@Module({})
export class ResendAdapterModule {
  static register(config: ResendAdapterConfig): DynamicModule {
    return {
      module: ResendAdapterModule,
      providers: [
        Logger,
        {
          provide: RESEND_ADAPTER_PROVIDER_CONFIG,
          useValue: config,
        },
        {
          provide: EMAIL_LOGGER,
          inject: [Logger],
          useFactory: () => createDefaultEmailLogger(),
        },
        {
          provide: EMAIL_PROVIDER,
          useClass: ResendAdapterService,
        },
      ],
      exports: [EMAIL_PROVIDER, RESEND_ADAPTER_PROVIDER_CONFIG],
    };
  }

  static registerAsync(options: {
    imports?: ModuleMetadata['imports'];
    inject?: InjectionToken[];
    useFactory: (
      ...args: unknown[]
    ) => Promise<ResendAdapterConfig> | ResendAdapterConfig;
  }): DynamicModule {
    return {
      module: ResendAdapterModule,
      imports: options.imports || [],
      providers: [
        Logger,
        {
          provide: RESEND_ADAPTER_PROVIDER_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: EMAIL_LOGGER,
          inject: [Logger],
          useFactory: () => createDefaultEmailLogger(),
        },
        {
          provide: EMAIL_PROVIDER,
          useClass: ResendAdapterService,
        },
      ],
      exports: [EMAIL_PROVIDER, RESEND_ADAPTER_PROVIDER_CONFIG],
    };
  }
}
