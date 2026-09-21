import { ExpoPushTicket } from 'expo-server-sdk';
import { ExpoAdapterService } from './expo-adapter.service';
import { ExpoAdapterConfig } from './expo-adapter-config.interface';
import {
  PUSH_NOTIFICATION_ERRORS,
  PushNotificationError,
} from '../abstract/push-notification.error';
import { PUSH_NOTIFICATION_STATUSES } from '../abstract/push-notification.service';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { LogInput } from '../../common/observability/logger/abstract/logger.interfaces';

/**
 * Collects every line as the text an adapter would actually emit, so the
 * rule-5 assertions below ("no push token in the log") read the whole entry —
 * message and data — rather than one field of it.
 */
class RecordingLogger extends LoggerService {
  readonly lines: string[] = [];
  setContext(): void {}
  log(input: LogInput): void {
    this.lines.push(JSON.stringify(input));
  }

  warn(input: LogInput): void {
    this.lines.push(JSON.stringify(input));
  }

  error(input: LogInput): void {
    this.lines.push(JSON.stringify(input));
  }

  debug(input: LogInput): void {
    this.lines.push(JSON.stringify(input));
  }
}

const sendPushNotificationsAsync = jest.fn();
const chunkPushNotifications = jest.fn();

// The token check stays real — it is what the adapter's validation path
// depends on — while the network calls are replaced.
jest.mock('expo-server-sdk', () => {
  const actual = jest.requireActual('expo-server-sdk');
  const MockExpo = jest.fn().mockImplementation(() => ({
    sendPushNotificationsAsync: (...args: unknown[]) =>
      sendPushNotificationsAsync(...args),
    chunkPushNotifications: (...args: unknown[]) =>
      chunkPushNotifications(...args),
  }));
  (MockExpo as unknown as { isExpoPushToken: unknown }).isExpoPushToken =
    actual.default.isExpoPushToken;
  return { ...actual, __esModule: true, default: MockExpo };
});

const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

/**
 * Expo's real `DeviceNotRegistered` ticket. The shape matters: `message` is
 * prose built out of the push token, which is why nothing may quote it, and
 * `details.error` is the closed code that may be surfaced instead. Fixtures
 * that put the bare code in `message` make the rule-5 tests below pass against
 * code that leaks.
 */
const deviceNotRegistered = (
  token: string,
): { status: string; message: string; details: Record<string, string> } => ({
  status: 'error',
  message: `"${token}" is not a registered push notification recipient`,
  details: { error: 'DeviceNotRegistered', expoPushToken: token },
});

const rejection = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise;
  } catch (e) {
    return e as Error;
  }
  throw new Error('expected the call to reject, and it resolved');
};

describe('ExpoAdapterService send paths', () => {
  const notification = {
    title: 'Launch',
    body: 'T-minus 10',
    data: { missionId: '7' },
  };

  let adapter: ExpoAdapterService;
  let logged: string[];

  beforeEach(() => {
    const logger = new RecordingLogger();
    adapter = new ExpoAdapterService(
      { expoAccessToken: 'test-token' } as ExpoAdapterConfig,
      logger,
    );
    logged = logger.lines;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('sendPushNotification', () => {
    it('sends one message with the sound, the payload and the deep link', async () => {
      sendPushNotificationsAsync.mockResolvedValue([
        { status: 'ok', id: 'ticket-1' },
      ]);

      await expect(
        adapter.sendPushNotification(TOKEN_A, {
          ...notification,
          deepLink: 'app://missions/7',
        }),
      ).resolves.toEqual({
        id: 'ticket-1',
        status: PUSH_NOTIFICATION_STATUSES.SUCCESS,
      });

      expect(sendPushNotificationsAsync).toHaveBeenCalledWith([
        {
          to: TOKEN_A,
          sound: 'default',
          title: 'Launch',
          body: 'T-minus 10',
          data: { missionId: '7', deepLink: 'app://missions/7' },
        },
      ]);
    });

    it('leaves deepLink out of the payload when there is none', async () => {
      sendPushNotificationsAsync.mockResolvedValue([
        { status: 'ok', id: 'ticket-1' },
      ]);

      await adapter.sendPushNotification(TOKEN_A, notification);

      const [[message]] = sendPushNotificationsAsync.mock.calls as [
        [Array<{ data: Record<string, unknown> }>],
      ];
      expect(message[0].data).toEqual({ missionId: '7' });
    });

    it('turns an error ticket into SEND_FAILED carrying the provider code', async () => {
      sendPushNotificationsAsync.mockResolvedValue([
        deviceNotRegistered(TOKEN_A),
      ]);

      const thrown = (await rejection(
        adapter.sendPushNotification(TOKEN_A, notification),
      )) as PushNotificationError;

      expect(thrown).toBeInstanceOf(PushNotificationError);
      expect(thrown.code).toBe(PUSH_NOTIFICATION_ERRORS.SEND_FAILED);
      // The code, not the prose the code came wrapped in.
      expect(thrown.message).toBe('DeviceNotRegistered');
      expect(thrown.message).not.toContain(TOKEN_A);
    });

    it('falls back to ProviderError when the ticket carries no code', async () => {
      sendPushNotificationsAsync.mockResolvedValue([
        { status: 'error', message: 'something went wrong upstream' },
      ]);

      const thrown = (await rejection(
        adapter.sendPushNotification(TOKEN_A, notification),
      )) as PushNotificationError;

      expect(thrown.message).toBe('ProviderError');
    });

    it('turns a thrown SDK failure into SEND_FAILED', async () => {
      sendPushNotificationsAsync.mockRejectedValue(new Error('network down'));

      const thrown = (await rejection(
        adapter.sendPushNotification(TOKEN_A, notification),
      )) as PushNotificationError;

      expect(thrown).toBeInstanceOf(PushNotificationError);
      expect(thrown.code).toBe(PUSH_NOTIFICATION_ERRORS.SEND_FAILED);
    });

    // Rule 5: a device token is a credential.
    it('never writes the device token to the log', async () => {
      sendPushNotificationsAsync.mockRejectedValue(new Error('network down'));

      await rejection(adapter.sendPushNotification(TOKEN_A, notification));

      expect(logged.join('\n')).not.toContain(TOKEN_A);
    });

    // The one that was missing: Expo builds the rejection prose out of the
    // token, so logging `ticket.message` leaks it even though no line names
    // the token itself.
    it('never quotes the provider prose when a ticket is rejected', async () => {
      const ticket = deviceNotRegistered(TOKEN_A);
      sendPushNotificationsAsync.mockResolvedValue([ticket]);

      await rejection(adapter.sendPushNotification(TOKEN_A, notification));

      expect(logged.join('\n')).not.toContain(TOKEN_A);
      expect(logged.join('\n')).not.toContain(ticket.message);
      expect(logged.join('\n')).toContain('DeviceNotRegistered');
    });
  });

  describe('sendPushNotificationInChunks', () => {
    it('drops invalid tokens before building the messages', async () => {
      chunkPushNotifications.mockReturnValue([]);
      sendPushNotificationsAsync.mockResolvedValue([]);

      await adapter.sendPushNotificationInChunks(
        [TOKEN_A, 'not-an-expo-token', TOKEN_B],
        notification,
      );

      const [messages] = chunkPushNotifications.mock.calls[0] as [
        Array<{ to: string }>,
      ];
      expect(messages.map((m) => m.to)).toEqual([TOKEN_A, TOKEN_B]);
    });

    it('sends every chunk the SDK hands back', async () => {
      chunkPushNotifications.mockReturnValue([
        [{ to: TOKEN_A }],
        [{ to: TOKEN_B }],
      ]);
      sendPushNotificationsAsync.mockResolvedValue([
        { status: 'ok', id: 'ticket-1' },
      ]);

      await adapter.sendPushNotificationInChunks(
        [TOKEN_A, TOKEN_B],
        notification,
      );

      expect(sendPushNotificationsAsync).toHaveBeenCalledTimes(2);
    });

    it('splits the tickets into successes and failures', async () => {
      const tickets: ExpoPushTicket[] = [
        { status: 'ok', id: 'ticket-1' },
        deviceNotRegistered(TOKEN_B),
      ] as unknown as ExpoPushTicket[];

      expect(adapter.getExpoPushNotificationChunkReport(tickets)).toEqual({
        successNotifications: [
          { id: 'ticket-1', status: PUSH_NOTIFICATION_STATUSES.SUCCESS },
        ],
        errorNotifications: [
          {
            message: 'DeviceNotRegistered',
            pushToken: TOKEN_B,
            status: PUSH_NOTIFICATION_STATUSES.ERROR,
          },
        ],
      });
    });

    it('reports an empty push token when the ticket carries no details', async () => {
      const tickets = [
        { status: 'error', message: 'MessageTooBig' },
      ] as unknown as ExpoPushTicket[];

      const report = adapter.getExpoPushNotificationChunkReport(tickets);

      expect(report.errorNotifications[0].pushToken).toBe('');
    });

    // Rule 5 again: the failing token is returned to the caller, which needs
    // it to revoke the device, but it must not reach the log — nor the
    // report's own `message`, where it used to arrive inside Expo's prose.
    it('keeps the failing device token out of the log and the report message', () => {
      const ticket = deviceNotRegistered(TOKEN_B);
      const tickets = [ticket] as unknown as ExpoPushTicket[];

      const report = adapter.getExpoPushNotificationChunkReport(tickets);

      expect(logged.join('\n')).not.toContain(TOKEN_B);
      expect(logged.join('\n')).not.toContain(ticket.message);
      expect(report.errorNotifications[0].message).toBe('DeviceNotRegistered');
      expect(report.errorNotifications[0].pushToken).toBe(TOKEN_B);
    });

    it('turns a thrown SDK failure into CHUNK_SEND_FAILED', async () => {
      chunkPushNotifications.mockImplementation(() => {
        throw new Error('network down');
      });

      const thrown = (await rejection(
        adapter.sendPushNotificationInChunks([TOKEN_A], notification),
      )) as PushNotificationError;

      expect(thrown).toBeInstanceOf(PushNotificationError);
      expect(thrown.code).toBe(PUSH_NOTIFICATION_ERRORS.CHUNK_SEND_FAILED);
    });
  });
});
