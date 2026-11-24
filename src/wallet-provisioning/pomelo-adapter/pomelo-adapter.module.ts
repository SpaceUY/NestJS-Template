import { Module } from '@nestjs/common';
import { TokenizationProvider } from '../abstract/tokenization-provider';
import { PomeloAuthClient } from './pomelo-auth.client';
import { PomeloTokenizationAdapter } from './pomelo-tokenization.adapter';

/** Pass to `WalletProvisioningAbstractModule.forRoot({ adapter })`. */
@Module({
  providers: [
    PomeloAuthClient,
    { provide: TokenizationProvider, useClass: PomeloTokenizationAdapter },
  ],
  exports: [TokenizationProvider],
})
export class PomeloAdapterModule {}
