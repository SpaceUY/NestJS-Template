import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import Expo, { ExpoPushTicket } from 'expo-server-sdk';
import { EXPO_ADAPTER_PROVIDER_CONFIG } from './expo-adapter-config-provider.const';
import { ExpoAdapterConfig } from './expo-adapter-config.interface';
import { IPushNotification } from '../abstract/push-notification.interface';
import {
  PushNotificationChunkReport,
  PushNotificationErrorResponse,
  PushNotificationService,
  PushNotificationStatusEnum,
  PushNotificationSuccessResponse,
} from '../abstract/push-notification.service';

@Injectable()
export class ExpoAdapterService extends PushNotificationService {
  expo: Expo;
  sound: string;
  errorLabel: string;
  constructor(
    @Inject(EXPO_ADAPTER_PROVIDER_CONFIG)
    config: ExpoAdapterConfig,
  ) {
    super();
    this.errorLabel = 'error';
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
        console.error(
          `[sendPushNotification]: Push token ${pushToken} is invalid`,
        );
        throw new InternalServerErrorException(
          `[sendPushNotification]: Push token ${pushToken} is invalid`,
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
      if (relatedTicket.status === ExpoStatusNotificationEnum.ERROR) {
        console.error(
          `[sendPushNotification]: ERROR: error send push notification to device token ${pushToken}. Error: ${relatedTicket.message}`,
        );
        throw new InternalServerErrorException(relatedTicket.message);
      }
      console.log(
        `[sendPushNotification]: Send notification succesfully to device token ${pushToken}`,
      );
      return {
        id: relatedTicket.id,
        status: PushNotificationStatusEnum.SUCCESS,
      };
    } catch (error) {
      console.error(
        `[sendPushNotification]: ERROR: error send push notification to device token ${pushToken}. Error: ${error}`,
      );
      throw error;
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
      console.error(
        `[sendChunksPushNotification]: ERROR: error send push notification to multiples devices. Error: ${error}`,
      );
      throw error;
    }
  }

  getExpoPushNotificationChunkReport(ticketChunks: ExpoPushTicket[]): {
    errorNotifications: PushNotificationErrorResponse[];
    successNotifications: PushNotificationSuccessResponse[];
  } {
    const successNotifications: PushNotificationSuccessResponse[] = [];
    const errorNotifications: PushNotificationErrorResponse[] = [];
    for (const ticket of ticketChunks) {
      if (ticket.status === ExpoStatusNotificationEnum.ERROR) {
        const errorToken = ticket.details?.expoPushToken;
        const errorMessage = ticket.message;
        console.error(
          `[sendPushNotificationInChunks]: ERROR: error send push notification to device token ${errorToken}. Error: ${errorMessage}`,
        );
        errorNotifications.push({
          message: ticket.message,
          pushToken: errorToken || '',
          status: PushNotificationStatusEnum.ERROR,
        });
      }
      if (ticket.status === ExpoStatusNotificationEnum.OK) {
        successNotifications.push({
          id: ticket.id,
          status: PushNotificationStatusEnum.SUCCESS,
        });
      }
    }
    return { successNotifications, errorNotifications };
  }
}

enum ExpoStatusNotificationEnum {
  OK = 'ok',
  ERROR = 'error',
}
