import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { ClassConstructor } from 'class-transformer';
import { LoggerService } from './logger.service';
import { LogTelemetryHook } from './logger.interfaces';

interface LoggerModuleOptions {
  adapter: ClassConstructor<LoggerService>;
  isGlobal?: boolean;
  telemetryHook?: LogTelemetryHook;
}

interface LoggerModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (...args: any[]) => Promise<LoggerService> | LoggerService;
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

  static forRootAsync(options: LoggerModuleAsyncOptions): DynamicModule {
    const { isGlobal = false, telemetryHook } = options;

    return {
      module: LoggerAbstractModule,
      global: isGlobal,
      imports: options.imports || [],
      providers: [
        {
          provide: LoggerService,
          useFactory: async (...args: any[]) => {
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
