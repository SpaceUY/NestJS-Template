import { Inject, Injectable, Logger } from '@nestjs/common';
import Expo, { ExpoPushTicket } from 'expo-server-sdk';
import { IPushNotification } from './push-notification.interface';
import configFactory from '@app/config/config.factory';
import { EXPO_ADAPTER_PROVIDER_CONFIG } from './expo-adapter-config-provider.const';
import { ExpoAdapterConfig } from './expo-adapter-config.interface';

@Injectable()
export class PushNotificationService extends PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  expo: Expo;
  sound: string;
  constructor(
    @Inject(EXPO_ADAPTER_PROVIDER_CONFIG)
    config: ExpoAdapterConfig,
  ) {
    super();
    this.sound = 'default';
    this.expo = new Expo({
      accessToken: config.expoAccessToken,
      useFcmV1: true,
    });
  }

  sendPushNotification(
    pushToken: string,
    notification: IPushNotification,
  ): Promise<void> {
    try {
      if (!Expo.isExpoPushToken(pushToken)) {
        this.logger.error(
          `[sendPushNotification]: Push token ${pushToken} is invalid`,
        );
      } else {
        const messages = [
          {
            to: pushToken,
            sound: this.sound,
            title: notification.title,
            body: notification.body,
            data: {
              ...notification.data,
              ...(notification.deepLink && { deepLink: notification.deepLink }),
              notificationType: notification.notificationType,
            },
          },
        ];

        this.expo
          .sendPushNotificationsAsync(messages)
          .then((expoPushTicket: ExpoPushTicket[]) => {
            if (expoPushTicket[0].status === 'error') {
              this.logger.error(
                `[sendPushNotification]: ERROR: error send push notification to device token ${pushToken}. Error: ${expoPushTicket[0].message}`,
              );
            } else {
              this.logger.log(
                `[sendPushNotification]: Send notification succesfully to device token ${pushToken}`,
              );
            }
          })
          .catch((error) => {
            this.logger.error(
              `[sendPushNotification]: ERROR: error send push notification to device token ${pushToken}. Error: ${error}`,
            );
          });
      }
    } catch (error) {
      this.logger.error(
        `[sendPushNotification]: ERROR: error send push notification to device token ${pushToken}. Error: ${error}`,
      );
    }
  }

  sendChunksPushNotification(
    pushTokens: string[],
    notification: IPushNotification,
  ) {
    try {
      const validTokens = pushTokens.filter((token) =>
        Expo.isExpoPushToken(token),
      );
      const messages = validTokens.map((token) => ({
        to: token,
        sound: this.sound,
        title: notification.title,
        body: notification.body,
        data: {
          ...notification.data,
          ...(notification.deepLink && { deepLink: notification.deepLink }),
          notificationType: notification.notificationType,
        },
      }));
      const chunks = this.expo.chunkPushNotifications(messages);

      const ticketPromises = chunks.map((chunk) => {
        return this.expo
          .sendPushNotificationsAsync(chunk)
          .then((ticketChunk: ExpoPushTicket[]) => {
            if (ticketChunk[0].status === 'error') {
              this.logger.error(
                `[sendChunksPushNotification]: ERROR: error send chunk notifications. Error: ${ticketChunk[0].message}`,
              );
            } else {
              this.logger.log(
                `[sendChunksPushNotification]: All chunks send successfully`,
              );
            }
          })
          .catch((error) => {
            this.logger.error(
              `[sendChunksPushNotification]: ERROR: error send chunk notifications. Error: ${error}`,
            );
          });
      });

      Promise.all(ticketPromises)
        .then(() => {
          this.logger.log(
            `[sendChunksPushNotification]: All chunks send successfully`,
          );
        })
        .catch((error) => {
          this.logger.error(
            `[sendChunksPushNotification]: ERROR: error send chunk notifications. Error: ${error}`,
          );
        });
    } catch (error) {
      this.logger.error(
        `[sendChunksPushNotification]: ERROR: error send push notification to multiples devices. Error: ${error}`,
      );
    }
  }
}
