import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
  Type,
} from '@nestjs/common';
import { EmailService } from './email.service';

interface EmailModuleOptions {
  adapter: Type<EmailService>;
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
          useClass: adapter,
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
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [EmailService],
    };
  }
}
