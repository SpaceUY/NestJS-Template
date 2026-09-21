import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';

interface EmailModuleOptions {
  // forRoot instantiates the adapter directly (no NestJS DI) so the module can
  // hand it the container's logger. Adapters that need constructor arguments
  // must use forRootAsync instead.
  adapter: new () => EmailService;
  isGlobal?: boolean;
}

// `TArgs` is the tuple of values the `inject` tokens resolve to. It is inferred
// from the factory at the call site, which is what keeps a typed factory —
// `(config: SomeScopeConfig) => ...` — assignable here. A plain `unknown[]`
// would reject it: function parameters are contravariant.
interface EmailModuleAsyncOptions<TArgs extends unknown[] = unknown[]> {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (...args: TArgs) => Promise<EmailService> | EmailService;
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

  static forRootAsync<TArgs extends unknown[]>(
    options: EmailModuleAsyncOptions<TArgs>,
  ): DynamicModule {
    const { isGlobal = false } = options;

    return {
      module: EmailAbstractModule,
      global: isGlobal,
      imports: options.imports || [],
      providers: [
        {
          provide: EmailService,
          useFactory: async (
            logger: LoggerService | undefined,
            ...args: TArgs
          ) => {
            const instance = await options.useFactory(...args);
            if (logger) instance.setLogger(logger);
            return instance;
          },
          inject: [
            { token: LoggerService, optional: true },
            ...(options.inject || []),
          ],
        },
      ],
      exports: [EmailService],
    };
  }
}
