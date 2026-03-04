import { DynamicModule, ForwardReference, Module, Type } from '@nestjs/common';
import { validateAdapterModule } from '../../common/utils/nest-module-validation';
import { EMAIL_PROVIDER } from './email-provider.const';
import { EmailService } from './email.service';

type AdapterModule =
  | Type<unknown>
  | DynamicModule
  | Promise<DynamicModule>
  | ForwardReference;

interface EmailModuleOptions {
  adapter: AdapterModule;
  useDefaultController?: boolean;
  isGlobal?: boolean;
  customController?: Type<unknown>[];
}

@Module({})
export class EmailAbstractModule {
  static forRoot(options: EmailModuleOptions): DynamicModule {
    const { adapter, isGlobal = false } = options;
    validateAdapterModule(adapter, 'EmailAbstractModule.forRoot');
    return {
      module: EmailAbstractModule,
      global: isGlobal,
      providers: [
        {
          provide: EmailService,
          useFactory: (adapter: EmailService) => adapter,
          inject: [EMAIL_PROVIDER],
        },
      ],
      imports: [adapter],
      exports: [EmailService],
    };
  }
}
