import { DynamicModule, Module, Type } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { TokenEventsService } from '../token-events.service';
import { WalletProvisioningController } from '../wallet-provisioning.controller';
import { WalletProvisioningRepository } from '../wallet-provisioning.repository';
import { WalletProvisioningService } from '../wallet-provisioning.service';
import { CardResolver } from './card-resolver';
import { WalletProvisioningHooks } from './wallet-provisioning-hooks';

export type WalletProvisioningModuleOptions = {
  // A module that provides and exports `TokenizationProvider` (e.g. PomeloAdapterModule).
  adapter: Type | DynamicModule;
  cardResolver: Type<CardResolver>;
  hooks: Type<WalletProvisioningHooks>;
};

@Module({})
export class WalletProvisioningAbstractModule {
  /**
   * Global so a processor's webhook module can inject `TokenEventsService` without importing
   * this module (which imports the adapter) back.
   */
  static forRoot(options: WalletProvisioningModuleOptions): DynamicModule {
    return {
      module: WalletProvisioningAbstractModule,
      global: true,
      imports: [AuthModule, options.adapter],
      controllers: [WalletProvisioningController],
      providers: [
        WalletProvisioningService,
        TokenEventsService,
        WalletProvisioningRepository,
        { provide: CardResolver, useClass: options.cardResolver },
        { provide: WalletProvisioningHooks, useClass: options.hooks },
      ],
      exports: [TokenEventsService, WalletProvisioningService],
    };
  }
}
