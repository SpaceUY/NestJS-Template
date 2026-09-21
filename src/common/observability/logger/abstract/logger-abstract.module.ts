import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
  Scope,
} from '@nestjs/common';
import { ClassConstructor } from 'class-transformer';
import { LoggerService } from './logger.service';
import { LogTelemetryHook } from './logger.interfaces';

interface LoggerModuleOptions {
  adapter: ClassConstructor<LoggerService>;
  isGlobal?: boolean;
  telemetryHook?: LogTelemetryHook;
}

// `TArgs` is the tuple of values the `inject` tokens resolve to. It is inferred
// from the factory at the call site, which is what keeps a typed factory —
// `(config: SomeScopeConfig) => ...` — assignable here. A plain `unknown[]`
// would reject it: function parameters are contravariant.
interface LoggerModuleAsyncOptions<TArgs extends unknown[] = unknown[]> {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (...args: TArgs) => Promise<LoggerService> | LoggerService;
  isGlobal?: boolean;
  telemetryHook?: LogTelemetryHook;
}

@Module({})
export class LoggerAbstractModule {
  static forRoot(options: LoggerModuleOptions): DynamicModule {
    const { adapter, isGlobal = false, telemetryHook } = options;

    return {
      module: LoggerAbstractModule,
      global: isGlobal,
      providers: [
        {
          provide: LoggerService,
          scope: Scope.TRANSIENT,
          useFactory: () => {
            const instance = new adapter();
            if (telemetryHook) instance.withTelemetry(telemetryHook);
            return instance;
          },
        },
      ],
      exports: [LoggerService],
    };
  }

  static forRootAsync<TArgs extends unknown[]>(
    options: LoggerModuleAsyncOptions<TArgs>,
  ): DynamicModule {
    const { isGlobal = false, telemetryHook } = options;

    return {
      module: LoggerAbstractModule,
      global: isGlobal,
      imports: options.imports || [],
      providers: [
        {
          provide: LoggerService,
          scope: Scope.TRANSIENT,
          useFactory: async (...args: TArgs) => {
            const instance = await options.useFactory(...args);
            if (telemetryHook) instance.withTelemetry(telemetryHook);
            return instance;
          },
          inject: options.inject || [],
        },
      ],
      exports: [LoggerService],
    };
  }
}
