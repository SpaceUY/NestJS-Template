import { Module } from '@nestjs/common';
import { PomeloIpGuard } from './pomelo-ip.guard';
import { PomeloSignatureGuard } from './pomelo-signature.guard';
import { PomeloWebhooksController } from './pomelo-webhooks.controller';

/** Import next to `WalletProvisioningAbstractModule.forRoot`, which provides TokenEventsService globally. */
@Module({
  controllers: [PomeloWebhooksController],
  providers: [PomeloIpGuard, PomeloSignatureGuard],
})
export class PomeloWebhooksModule {}
