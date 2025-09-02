import { DynamicModule, Logger, Module } from '@nestjs/common';
import { adaptLogger } from './standard-logger.interface';

export const STANDARD_LOGGER = 'STANDARD_LOGGER';

@Module({})
export class CommonLoggerModule {
  static forRoot(context = 'App'): DynamicModule {
    return {
      module: CommonLoggerModule,
      providers: [
        Logger,
        {
          provide: STANDARD_LOGGER,
          inject: [Logger],
          useFactory: (nestLogger: Logger) => {
            // set context if available
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (nestLogger as any).setContext?.(context);
            return adaptLogger(nestLogger);
          },
        },
      ],
      exports: [STANDARD_LOGGER],
    };
  }
}
