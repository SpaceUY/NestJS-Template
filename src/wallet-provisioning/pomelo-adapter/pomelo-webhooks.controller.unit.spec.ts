import { HttpException } from '@nestjs/common';
import { THROTTLER_SKIP } from '@nestjs/throttler/dist/throttler.constants';
import {
  WALLET_PROVISIONING_ERRORS,
  WalletProvisioningError,
} from '../abstract/wallet-provisioning.error';
import { TokenEventsService } from '../token-events.service';
import { PomeloWebhooksController } from './pomelo-webhooks.controller';

const base = {
  card_id: 'crd-1',
  user_id: 'usr-1',
  token_external_id: 'tok-1',
  origin: 'APPLE_PAY',
  idempotency_key: 'k',
};

describe('PomeloWebhooksController', () => {
  let tokenEvents: jest.Mocked<Pick<TokenEventsService, 'apply'>>;
  let controller: PomeloWebhooksController;

  beforeEach(() => {
    tokenEvents = { apply: jest.fn().mockResolvedValue(null) };
    controller = new PomeloWebhooksController(
      tokenEvents as unknown as TokenEventsService,
    );
  });

  it('is exempt from the global rate limiter: Pomelo retries from a few addresses and the guards already protect the routes', () => {
    expect(
      Reflect.getMetadata(`${THROTTLER_SKIP}default`, PomeloWebhooksController),
    ).toBe(true);
  });

  it('calls TokenEventsService.apply with the mapped lifecycle event', async () => {
    await controller.tokenLifecycle({
      ...base,
      event_id: 'e',
      status: 'ACTIVATED',
    });
    expect(tokenEvents.apply).toHaveBeenCalledWith({
      cardExternalId: 'crd-1',
      tokenExternalId: 'tok-1',
      wallet: 'APPLE_PAY',
      kind: 'LIFECYCLE',
      status: 'ACTIVATED',
    });
  });

  it('calls apply with the mapped notification', async () => {
    await controller.tokenNotification({
      ...base,
      event_id: 'tokenization-abandoned-notification',
    });
    expect(tokenEvents.apply).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'ABANDONED' }),
    );
  });

  it('answers 2XX and skips apply for missing ids or unknown events', async () => {
    await expect(
      controller.tokenLifecycle({
        ...base,
        card_id: undefined,
        status: 'ACTIVATED',
      }),
    ).resolves.toBeUndefined();
    await expect(
      controller.tokenLifecycle({ ...base, status: 'SOMETHING_NEW' }),
    ).resolves.toBeUndefined();
    await expect(
      controller.tokenNotification({ ...base, event_id: 'tokenization-other' }),
    ).resolves.toBeUndefined();
    expect(tokenEvents.apply).not.toHaveBeenCalled();
  });

  it('answers 5XX when the row keeps changing, so Pomelo retries', async () => {
    tokenEvents.apply.mockRejectedValue(
      new WalletProvisioningError(
        WALLET_PROVISIONING_ERRORS.CONCURRENT_UPDATE,
        'changed',
      ),
    );
    const error = await controller
      .tokenLifecycle({ ...base, status: 'ACTIVATED' })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(503);
  });

  it('lets other failures reach the error filter, so Pomelo retries', async () => {
    tokenEvents.apply.mockRejectedValue(new Error('database down'));
    await expect(
      controller.tokenLifecycle({ ...base, status: 'ACTIVATED' }),
    ).rejects.toThrow('database down');
  });
});
