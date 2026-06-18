import { DynamicModule, Logger, Module } from '@nestjs/common';

@Module({})
export class CommonLoggerModule {
  static forRoot(context = 'App'): DynamicModule {
    return {
      module: CommonLoggerModule,
      providers: [
        {
          provide: Logger,
          useFactory: () => new Logger(context),
        },
      ],
      exports: [Logger],
    };
  }
}
