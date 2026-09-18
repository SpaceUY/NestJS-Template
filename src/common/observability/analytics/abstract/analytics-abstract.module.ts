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

interface AnalyticsModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => Promise<AnalyticsService> | AnalyticsService;
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

  static forRootAsync(options: AnalyticsModuleAsyncOptions): DynamicModule {
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
