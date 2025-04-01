import { IPushNotification } from './push-notification.interface';

/**
 * Interface for the file object returned by the Cloud Storage provider.
 * @property {string} url - The public URL where the file can be accessed.
 * @property {string} id - The unique identifier assigned to the file in the cloud provider.
 */
interface PushNotificationFile {
  url: string;
  id: string; // TODO: La usaremos?
}

/**
 * Interface for adapters to implement to work alongside the `PushNotificationModule.`
 */
export abstract class PushNotificationService {
  /**
   * Send a push notification to a specific mobile device.
   * @param {string} pushToken - The push notification token of the target device.
   * @returns {Promise<void>}
   */
  abstract sendPushNotification(
    pushToken: string,
    notification: IPushNotification,
  ): Promise<void>; // TODO: void??

  /**
   * Send a push notification to a multiples mobile devices.
   * @param {string[]} pushTokens - The push notification tokens for the target devices
   * @returns {void}
   */
  abstract sendPushNotificationInChunks(
    pushTokens: string[],
    notification: IPushNotification,
  ): Promise<void>;
}
