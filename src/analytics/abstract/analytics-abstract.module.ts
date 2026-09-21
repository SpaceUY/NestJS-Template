import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
  Type,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

interface AnalyticsModuleOptions {
  adapter: Type<AnalyticsService>;
  isGlobal?: boolean;
}

// `TArgs` is the tuple of values the `inject` tokens resolve to. It is inferred
// from the factory at the call site, which is what keeps a typed factory —
// `(config: AnalyticsScopeConfig) => ...` — assignable here. A plain
// `unknown[]` would reject it: function parameters are contravariant.
interface AnalyticsModuleAsyncOptions<TArgs extends unknown[] = unknown[]> {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (...args: TArgs) => Promise<AnalyticsService> | AnalyticsService;
  isGlobal?: boolean;
}

@Module({})
export class AnalyticsAbstractModule {
  static forRoot(options: AnalyticsModuleOptions): DynamicModule {
    const { adapter, isGlobal = false } = options;

    return {
      module: AnalyticsAbstractModule,
      global: isGlobal,
      providers: [
        {
          provide: AnalyticsService,
          useClass: adapter,
        },
      ],
      exports: [AnalyticsService],
    };
  }

  static forRootAsync<TArgs extends unknown[]>(
    options: AnalyticsModuleAsyncOptions<TArgs>,
  ): DynamicModule {
    const { isGlobal = false } = options;

    return {
      module: AnalyticsAbstractModule,
      global: isGlobal,
      imports: options.imports || [],
      providers: [
        {
          provide: AnalyticsService,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [AnalyticsService],
    };
  }
}
