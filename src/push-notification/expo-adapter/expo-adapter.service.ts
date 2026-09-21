import { Inject, Injectable, Optional } from '@nestjs/common';
import Expo, { ExpoPushErrorTicket, ExpoPushTicket } from 'expo-server-sdk';
import { EXPO_ADAPTER_PROVIDER_CONFIG } from './expo-adapter-config-provider.const';
import { type ExpoAdapterConfig } from './expo-adapter-config.interface';
import { IPushNotification } from '../abstract/push-notification.interface';
import {
  PUSH_NOTIFICATION_STATUSES,
  PushNotificationChunkReport,
  PushNotificationErrorResponse,
  PushNotificationService,
  PushNotificationSuccessResponse,
} from '../abstract/push-notification.service';
import {
  PUSH_NOTIFICATION_ERRORS,
  PushNotificationError,
} from '../abstract/push-notification.error';
import { PUSH_NOTIFICATION_EXPO_STATUSES } from './expo.types';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';

@Injectable()
export class ExpoAdapterService extends PushNotificationService {
  private expo: Expo;
  private sound: string;
  constructor(
    @Inject(EXPO_ADAPTER_PROVIDER_CONFIG)
    config: ExpoAdapterConfig,
    // Optional so the module still registers in a project that has not wired
    // `LoggerAbstractModule`; injected, the adapter's lines carry the trace id
    // and fire the telemetry hook like every other module's.
    @Optional() logger?: LoggerService,
  ) {
    super();
    if (logger) this.setLogger(logger);
    this.sound = 'default';
    this.expo = new Expo({
      accessToken: config.expoAccessToken,
      useFcmV1: true,
    });
  }

  async sendPushNotification(
    pushToken: string,
    notification: IPushNotification,
  ): Promise<PushNotificationSuccessResponse> {
    try {
      if (!Expo.isExpoPushToken(pushToken)) {
        // The token itself never reaches the log: it is a device credential.
        this.logger.error({ message: 'push token is not an Expo token' });
        throw new PushNotificationError(
          PUSH_NOTIFICATION_ERRORS.INVALID_TOKEN,
          'Push token is not a valid Expo push token',
        );
      }
      const message = [
        {
          to: pushToken,
          sound: this.sound,
          title: notification.title,
          body: notification.body,
          data: {
            ...notification.data,
            ...(notification.deepLink && { deepLink: notification.deepLink }),
          },
        },
      ];
      const expoPushTicket: ExpoPushTicket[] =
        await this.expo.sendPushNotificationsAsync(message);
      const relatedTicket = expoPushTicket[0];
      if (relatedTicket.status === PUSH_NOTIFICATION_EXPO_STATUSES.ERROR) {
        const providerError = this._providerErrorOf(relatedTicket);
        this.logger.error({
          message: 'push notification rejected by the provider',
          data: { providerError },
        });
        throw new PushNotificationError(
          PUSH_NOTIFICATION_ERRORS.SEND_FAILED,
          providerError,
        );
      }
      this.logger.log({ message: 'push notification sent' });
      return {
        id: relatedTicket.id,
        status: PUSH_NOTIFICATION_STATUSES.SUCCESS,
      };
    } catch (error) {
      // No `error:` field: an Expo rejection can quote the submitted push
      // token, and that is a device credential (rule 5).
      this.logger.error({
        message: 'push notification send failed',
        data: { kind: error instanceof Error ? error.name : typeof error },
      });
      throw this._asModuleError(error, PUSH_NOTIFICATION_ERRORS.SEND_FAILED);
    }
  }

  async sendPushNotificationInChunks(
    pushTokens: string[],
    notification: IPushNotification,
  ): Promise<PushNotificationChunkReport> {
    try {
      const validTokens = pushTokens.filter((token) =>
        Expo.isExpoPushToken(token),
      );
      let ticketChunks: ExpoPushTicket[] = [];
      const messages = validTokens.map((token) => ({
        to: token,
        sound: this.sound,
        title: notification.title,
        body: notification.body,
        data: {
          ...notification.data,
          ...(notification.deepLink && { deepLink: notification.deepLink }),
        },
      }));
      const chunks = this.expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        ticketChunks = await this.expo.sendPushNotificationsAsync(chunk);
      }
      const { successNotifications, errorNotifications } =
        this.getExpoPushNotificationChunkReport(ticketChunks);
      return { successNotifications, errorNotifications };
    } catch (error) {
      this.logger.error({
        message: 'chunked push notification send failed',
        data: {
          kind: error instanceof Error ? error.name : typeof error,
          tokenCount: pushTokens.length,
        },
      });
      throw this._asModuleError(
        error,
        PUSH_NOTIFICATION_ERRORS.CHUNK_SEND_FAILED,
      );
    }
  }

  /**
   * No `expo-server-sdk` failure leaves this adapter raw: callers depend on
   * `PushNotificationError` and nothing below it (invariant `T3`).
   *
   * The SDK's own message is dropped rather than forwarded, for the same
   * reason `_providerErrorOf` exists: a thrown `expo-server-sdk` error can
   * quote the request it was given, and that request carries the device token
   * (rule 5). The error's *kind* is what the failure log records; the caller
   * gets the code, which is what it branches on.
   */
  private _asModuleError(
    error: unknown,
    code: (typeof PUSH_NOTIFICATION_ERRORS)[keyof typeof PUSH_NOTIFICATION_ERRORS],
  ): PushNotificationError {
    if (error instanceof PushNotificationError) return error;
    return new PushNotificationError(code, 'Push notification failed');
  }

  /**
   * The provider's error **code**, never its prose. `ExpoPushErrorTicket.message`
   * is free text that Expo routinely builds out of the push token it was given
   * — `DeviceNotRegistered` reads `"ExponentPushToken[…]" is not a registered
   * push notification recipient` — so quoting it anywhere leaks a device
   * credential (rule 5). `details.error` is a closed set and safe to surface.
   */
  private _providerErrorOf(ticket: ExpoPushErrorTicket): string {
    return ticket.details?.error ?? 'ProviderError';
  }

  getExpoPushNotificationChunkReport(ticketChunks: ExpoPushTicket[]): {
    errorNotifications: PushNotificationErrorResponse[];
    successNotifications: PushNotificationSuccessResponse[];
  } {
    const successNotifications: PushNotificationSuccessResponse[] = [];
    const errorNotifications: PushNotificationErrorResponse[] = [];
    for (const ticket of ticketChunks) {
      if (ticket.status === PUSH_NOTIFICATION_EXPO_STATUSES.ERROR) {
        const errorToken = ticket.details?.expoPushToken;
        const providerError = this._providerErrorOf(ticket);
        // The token reaches the caller in its own field, because revoking the
        // device needs it. It reaches nothing else: not this line, and not the
        // report's `message` (rule 5).
        this.logger.error({
          message: 'push notification rejected for one device',
          data: { providerError },
        });
        errorNotifications.push({
          message: providerError,
          pushToken: errorToken || '',
          status: PUSH_NOTIFICATION_STATUSES.ERROR,
        });
      }
      if (ticket.status === PUSH_NOTIFICATION_EXPO_STATUSES.OK) {
        successNotifications.push({
          id: ticket.id,
          status: PUSH_NOTIFICATION_STATUSES.SUCCESS,
        });
      }
    }
    return { successNotifications, errorNotifications };
  }
}
