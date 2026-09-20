import { ExpoAdapterService } from './expo-adapter.service';
import { ExpoAdapterConfig } from './expo-adapter-config.interface';
import {
  PUSH_NOTIFICATION_ERRORS,
  PushNotificationError,
} from '../abstract/push-notification.error';

const rejection = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise;
  } catch (e) {
    return e as Error;
  }
  throw new Error('expected the call to reject, and it resolved');
};

describe('ExpoAdapterService', () => {
  const adapter = new ExpoAdapterService({
    expoAccessToken: 'test-token',
  } as ExpoAdapterConfig);
  const notification = { title: 'a', body: 'b', data: {} };

  it('rejects a non-Expo push token with the module error, not an HTTP one', async () => {
    const thrown = await rejection(
      adapter.sendPushNotification('not-an-expo-token', notification),
    );

    expect(thrown).toBeInstanceOf(PushNotificationError);
    expect((thrown as PushNotificationError).code).toBe(
      PUSH_NOTIFICATION_ERRORS.INVALID_TOKEN,
    );
    expect(thrown).not.toHaveProperty('getStatus');
  });

  it('keeps the offending token out of the error message', async () => {
    const thrown = await rejection(
      adapter.sendPushNotification(
        'ExponentPushToken[not-real-abc123]',
        notification,
      ),
    );

    expect(thrown.message).not.toContain('abc123');
  });
});
