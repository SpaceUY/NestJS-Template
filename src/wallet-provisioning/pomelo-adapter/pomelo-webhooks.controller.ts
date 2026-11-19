import {
  Body,
  Controller,
  HttpCode,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  WALLET_PROVISIONING_ERRORS,
  WalletProvisioningError,
} from '../abstract/wallet-provisioning.error';
import { TokenEvent } from '../abstract/wallet-provisioning.types';
import { TokenEventsService } from '../token-events.service';
import { PomeloIpGuard } from './pomelo-ip.guard';
import { PomeloSignatureGuard } from './pomelo-signature.guard';
import {
  toTokenEventFromLifecycle,
  toTokenEventFromNotification,
} from './pomelo-token-event.mapper';
import {
  PomeloTokenLifecyclePayload,
  PomeloTokenNotificationPayload,
} from './pomelo.types';

/**
 * Pomelo's token webhooks. Events that cannot be applied (unknown status or event, missing ids)
 * are acknowledged with 2XX so Pomelo stops retrying them; a failure to apply answers 5XX so it
 * retries.
 */
@ApiExcludeController()
// Pomelo calls (and retries) from a few addresses the throttler would see as one client; the IP and
// signature guards already protect these routes.
@SkipThrottle()
@UseGuards(PomeloIpGuard, PomeloSignatureGuard)
@Controller('wallet-provisioning/webhooks/pomelo')
export class PomeloWebhooksController {
  constructor(private readonly tokenEvents: TokenEventsService) {}

  @Post('token-lifecycle')
  @HttpCode(200)
  tokenLifecycle(@Body() payload: PomeloTokenLifecyclePayload): Promise<void> {
    return this.apply(toTokenEventFromLifecycle(payload));
  }

  @Post('token-notification')
  @HttpCode(200)
  tokenNotification(
    @Body() payload: PomeloTokenNotificationPayload,
  ): Promise<void> {
    return this.apply(toTokenEventFromNotification(payload));
  }

  private async apply(event: TokenEvent | null): Promise<void> {
    if (!event) return;
    try {
      await this.tokenEvents.apply(event);
    } catch (error) {
      if (
        error instanceof WalletProvisioningError &&
        error.code === WALLET_PROVISIONING_ERRORS.CONCURRENT_UPDATE
      ) {
        throw new ServiceUnavailableException();
      }
      throw error;
    }
  }
}
