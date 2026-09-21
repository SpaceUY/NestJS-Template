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
      exports: [PUSH_NOTIFICATION_PROVIDER],
    };
  }

  // `TArgs` is the tuple of values the `inject` tokens resolve to, inferred
  // from the factory at the call site. `unknown[]` would reject a typed
  // factory: function parameters are contravariant.
  static registerAsync<TArgs extends unknown[]>(options: {
    imports?: ModuleMetadata['imports'];
    inject?: InjectionToken[];
    useFactory: (
      ...args: TArgs
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
      exports: [PUSH_NOTIFICATION_PROVIDER],
    };
  }
}
