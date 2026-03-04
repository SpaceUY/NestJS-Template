import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { SendgridAdapterService } from './sendgrid-adapter.service';
import { SendgridAdapterConfig } from './sendgrid-adapter-config.interface';
import { SENDGRID_ADAPTER_PROVIDER_CONFIG } from './sendgrid-adapter-config-provider.const';
import { EMAIL_PROVIDER } from '../abstract/email-provider.const';
// No template service wiring in mail adapters anymore
import { Logger } from '@nestjs/common';
import { EMAIL_LOGGER } from '../abstract/email-logger.interface';
import { createDefaultEmailLogger } from '../utils/email-logger.adapter';
// Logger token can be provided by the application if desired

@Module({})
export class SendgridAdapterModule {
  static register(config: SendgridAdapterConfig): DynamicModule {
    return {
      module: SendgridAdapterModule,
      providers: [
        Logger,
        {
          provide: SENDGRID_ADAPTER_PROVIDER_CONFIG,
          useValue: config,
        },
        {
          provide: EMAIL_LOGGER,
          inject: [Logger],
          useFactory: () => createDefaultEmailLogger(),
        },
        {
          provide: EMAIL_PROVIDER,
          useClass: SendgridAdapterService,
        },
      ],
      exports: [EMAIL_PROVIDER, SENDGRID_ADAPTER_PROVIDER_CONFIG],
    };
  }

  static registerAsync(options: {
    imports?: ModuleMetadata['imports'];
    inject?: InjectionToken[];
    useFactory: (
      ...args: unknown[]
    ) => Promise<SendgridAdapterConfig> | SendgridAdapterConfig;
  }): DynamicModule {
    return {
      module: SendgridAdapterModule,
      imports: options.imports || [],
      providers: [
        Logger,
        {
          provide: SENDGRID_ADAPTER_PROVIDER_CONFIG,
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
          useClass: SendgridAdapterService,
        },
      ],
      exports: [EMAIL_PROVIDER, SENDGRID_ADAPTER_PROVIDER_CONFIG],
    };
  }
}
