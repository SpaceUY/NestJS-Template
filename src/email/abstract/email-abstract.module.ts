import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { LoggerService } from '../../common/logger/abstract/logger.service';

interface EmailModuleOptions {
  // forRoot instantiates the adapter directly (no NestJS DI). Adapters that
  // need constructor arguments must use forRootAsync instead.
  adapter: new () => EmailService;
  isGlobal?: boolean;
}

interface EmailModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (...args: any[]) => Promise<EmailService> | EmailService;
  isGlobal?: boolean;
}

@Module({})
export class EmailAbstractModule {
  static forRoot(options: EmailModuleOptions): DynamicModule {
    const { adapter, isGlobal = false } = options;

    return {
      module: EmailAbstractModule,
      global: isGlobal,
      providers: [
        {
          provide: EmailService,
          useFactory: (logger?: LoggerService) => {
            const instance = new adapter();
            if (logger) instance.setLogger(logger);
            return instance;
          },
          inject: [{ token: LoggerService, optional: true }],
        },
      ],
      exports: [EmailService],
    };
  }

  static forRootAsync(options: EmailModuleAsyncOptions): DynamicModule {
    const { isGlobal = false } = options;

    return {
      module: EmailAbstractModule,
      global: isGlobal,
      imports: options.imports || [],
      providers: [
        {
          provide: EmailService,
          useFactory: async (logger: LoggerService | undefined, ...args: unknown[]) => {
            const instance = await options.useFactory(...args);
            if (logger) instance.setLogger(logger);
            return instance;
          },
          inject: [{ token: LoggerService, optional: true }, ...(options.inject || [])],
        },
      ],
      exports: [EmailService],
    };
  }
}
