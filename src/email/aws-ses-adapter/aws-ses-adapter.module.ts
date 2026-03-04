import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { AwsSesAdapterConfig } from './aws-ses-adapter-config.interface';
import { AWS_SES_ADAPTER_PROVIDER_CONFIG } from './aws-ses-adapter-config-provider.const';
import { EMAIL_PROVIDER } from '../abstract/email-provider.const';
import { AwsSesAdapterService } from './aws-ses-adapter.service';

@Module({})
export class AwsSesAdapterModule {
  static register(config: AwsSesAdapterConfig): DynamicModule {
    return {
      module: AwsSesAdapterModule,
      providers: [
        {
          provide: AWS_SES_ADAPTER_PROVIDER_CONFIG,
          useValue: config,
        },
        { provide: EMAIL_PROVIDER, useClass: AwsSesAdapterService },
      ],
      exports: [EMAIL_PROVIDER, AWS_SES_ADAPTER_PROVIDER_CONFIG],
    };
  }

  static registerAsync(options: {
    imports?: ModuleMetadata['imports'];
    inject?: InjectionToken[];
    useFactory: (
      ...args: any[]
    ) => Promise<AwsSesAdapterConfig> | AwsSesAdapterConfig;
  }): DynamicModule {
    return {
      module: AwsSesAdapterModule,
      imports: options.imports || [],
      providers: [
        {
          provide: AWS_SES_ADAPTER_PROVIDER_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        { provide: EMAIL_PROVIDER, useClass: AwsSesAdapterService },
      ],
      exports: [EMAIL_PROVIDER, AWS_SES_ADAPTER_PROVIDER_CONFIG],
    };
  }
}
