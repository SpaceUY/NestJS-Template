import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PushNotificationController } from './push-notification.controller';
import { PushNotificationService } from './push-notification.service';
import {
  PUSH_NOTIFICATION_ERRORS,
  PushNotificationError,
} from './push-notification.error';
import { PushNotificationDto } from './dto/push-notification.dto';

const dto = { title: 'Hi', body: 'There' } as PushNotificationDto;

const rejection = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise;
  } catch (e) {
    return e as Error;
  }
  throw new Error('expected the call to reject, and it resolved');
};

const controllerOver = (
  sendPushNotification: jest.Mock,
): PushNotificationController =>
  new PushNotificationController({
    sendPushNotification,
    sendPushNotificationInChunks: jest.fn(),
  } as unknown as PushNotificationService);

describe('PushNotificationController', () => {
  it('answers 400 when the module reports an invalid token', async () => {
    const controller = controllerOver(
      jest
        .fn()
        .mockRejectedValue(
          new PushNotificationError(
            PUSH_NOTIFICATION_ERRORS.INVALID_TOKEN,
            'Push token is not a valid Expo push token',
          ),
        ),
    );

    await expect(controller.sendPushNotification('nope', dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('answers 500 for a send failure without echoing the provider message', async () => {
    const controller = controllerOver(
      jest
        .fn()
        .mockRejectedValue(
          new PushNotificationError(
            PUSH_NOTIFICATION_ERRORS.SEND_FAILED,
            'DeviceNotRegistered: ExponentPushToken[abc123]',
          ),
        ),
    );

    const thrown = await rejection(
      controller.sendPushNotification('token', dto),
    );

    expect(thrown).toBeInstanceOf(InternalServerErrorException);
    expect(thrown.message).toBe('The push notification could not be sent');
    expect(JSON.stringify(thrown)).not.toContain('ExponentPushToken');
  });

  it('answers 500 for any other failure, leaking nothing', async () => {
    const controller = controllerOver(
      jest
        .fn()
        .mockRejectedValue(new TypeError('connect ECONNREFUSED 10.0.0.7:443')),
    );

    const thrown = await rejection(
      controller.sendPushNotification('token', dto),
    );

    expect(thrown).toBeInstanceOf(InternalServerErrorException);
    expect(JSON.stringify(thrown)).not.toContain('10.0.0.7');
  });

  it('resolves when the send succeeds', async () => {
    const send = jest.fn().mockResolvedValue({ id: '1', status: 'SUCCESS' });

    await expect(
      controllerOver(send).sendPushNotification('token', dto),
    ).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledWith('token', dto);
  });
});
