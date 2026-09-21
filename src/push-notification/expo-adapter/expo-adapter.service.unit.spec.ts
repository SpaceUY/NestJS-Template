import { ExpoAdapterService } from './expo-adapter.service';
import { ExpoAdapterConfig } from './expo-adapter-config.interface';
import {
  PUSH_NOTIFICATION_ERRORS,
  PushNotificationError,
} from '../abstract/push-notification.error';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/observability/logger/nest-adapter/nest-logger.adapter';

/** Keeps the adapter's own log lines out of the test output. */
class SilentLogger extends LoggerService {
  context = '';
  setContext(context: string): void {
    this.context = context;
  }

  log(): void {}
  warn(): void {}
  error(): void {}
  debug(): void {}
}

const rejection = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise;
  } catch (e) {
    return e as Error;
  }
  throw new Error('expected the call to reject, and it resolved');
};

describe('ExpoAdapterService', () => {
  const adapter = new ExpoAdapterService(
    { expoAccessToken: 'test-token' } as ExpoAdapterConfig,
    new SilentLogger(),
  );
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

  describe('logger wiring', () => {
    it('tags the injected logger with the adapter context', () => {
      const logger = new SilentLogger();

      new ExpoAdapterService(
        { expoAccessToken: 'test-token' } as ExpoAdapterConfig,
        logger,
      );

      expect(logger.context).toBe('ExpoAdapterService');
    });

    // @Optional(): the module has to register in a project that never wired
    // LoggerAbstractModule, so the base class supplies its own adapter.
    it('falls back to a NestLoggerAdapter when none is injected', () => {
      const adapterWithoutLogger = new ExpoAdapterService({
        expoAccessToken: 'test-token',
      } as ExpoAdapterConfig);

      expect(
        (adapterWithoutLogger as unknown as { logger: LoggerService }).logger,
      ).toBeInstanceOf(NestLoggerAdapter);
    });
  });
});
