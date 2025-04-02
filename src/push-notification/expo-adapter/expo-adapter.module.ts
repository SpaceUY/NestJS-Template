import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { ExpoAdapterService } from './expo-adapter.service';
import { ExpoAdapterConfig } from './expo-adapter-config.interface';
import { EXPO_ADAPTER_PROVIDER_CONFIG } from './expo-adapter-config-provider.const';
import { PUSH_NOTIFICATION_PROVIDER } from '../abstract/push-notification-provider.const';

@Module({})
export class ExpoAdapterModule {
  static register(config: ExpoAdapterConfig): DynamicModule {
    return {
      module: ExpoAdapterModule,
      providers: [
        {
          provide: EXPO_ADAPTER_PROVIDER_CONFIG,
          useValue: config,
        },
        { provide: PUSH_NOTIFICATION_PROVIDER, useClass: ExpoAdapterService },
      ],
      exports: [PUSH_NOTIFICATION_PROVIDER, EXPO_ADAPTER_PROVIDER_CONFIG],
    };
  }

  static registerAsync(options: {
    imports?: ModuleMetadata['imports'];
    inject?: InjectionToken[];
    useFactory: (
      ...args: any[]
    ) => Promise<ExpoAdapterConfig> | ExpoAdapterConfig;
  }): DynamicModule {
    return {
      module: ExpoAdapterModule,
      imports: options.imports || [],
      providers: [
        {
          provide: EXPO_ADAPTER_PROVIDER_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        { provide: PUSH_NOTIFICATION_PROVIDER, useClass: ExpoAdapterService },
      ],
      exports: [PUSH_NOTIFICATION_PROVIDER, EXPO_ADAPTER_PROVIDER_CONFIG],
    };
  }
}
