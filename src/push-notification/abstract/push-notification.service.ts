import { IPushNotification } from './push-notification.interface';

export const PUSH_NOTIFICATION_STATUSES = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
} as const;

export type PushNotificationStatus =
  (typeof PUSH_NOTIFICATION_STATUSES)[keyof typeof PUSH_NOTIFICATION_STATUSES];
/**
 * Interface for the success push notification object returned by the Push Notification provider.
 * @property {string} id - The unique identifier assigned to the notification in the push notification provider.
 * @property {string} status - Indicates the current status of the notification ("SUCCESS").
 */
export interface PushNotificationSuccessResponse {
  id: string;
  status: PushNotificationStatus;
}
/**
 * Interface for the error push notification object returned by the Push Notification provider.
 * @property {string} pushToken - The failed push notification token of the target device.
 * @property {string} status - Indicates the current status of the notification ("ERROR").
 * @property {string} message - Additional information related to the error status.
 */
export interface PushNotificationErrorResponse {
  pushToken: string;
  message: string;
  status: PushNotificationStatus;
}

/**
 * Interface for the push notification report object returned by the Push Notification provider when send multiple notifications in chunks.
 * @property {PushNotificationSuccessResponse[]} successNotifications - Array of success notifications.
 * @property {PushNotificationErrorResponse[]} errorNotifications - Array of failed notifications.
 */
export interface PushNotificationChunkReport {
  successNotifications: PushNotificationSuccessResponse[];
  errorNotifications: PushNotificationErrorResponse[];
}
/**
 * Interface for adapters to implement to work alongside the `PushNotificationModule.`
 */
export abstract class PushNotificationService {
  /**
   * Send a push notification to a specific mobile device.
   * @param {string} pushToken - The push notification token of the target device.
   * @returns {Promise<PushNotificationResponse>} An object containing the push notification response.
   */
  abstract sendPushNotification(
    pushToken: string,
    notification: IPushNotification,
  ): Promise<PushNotificationSuccessResponse>;

  /**
   * Send a push notification to a multiples mobile devices.
   * @param {string[]} pushTokens - The push notification tokens for the target devices
   * @returns {void}
   */
  abstract sendPushNotificationInChunks(
    pushTokens: string[],
    notification: IPushNotification,
  ): Promise<PushNotificationChunkReport>;
}
