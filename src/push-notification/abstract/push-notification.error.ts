export const PUSH_NOTIFICATION_ERRORS = {
  INVALID_TOKEN: 'PUSH_NOTIFICATION_INVALID_TOKEN',
  SEND_FAILED: 'PUSH_NOTIFICATION_SEND_FAILED',
  CHUNK_SEND_FAILED: 'PUSH_NOTIFICATION_CHUNK_SEND_FAILED',
} as const;

export type PushNotificationErrorCode =
  (typeof PUSH_NOTIFICATION_ERRORS)[keyof typeof PUSH_NOTIFICATION_ERRORS];

export class PushNotificationError extends Error {
  constructor(
    public readonly code: PushNotificationErrorCode,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PushNotificationError';
  }
}
