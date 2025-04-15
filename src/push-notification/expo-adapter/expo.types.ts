export const PUSH_NOTIFICATION_EXPO_STATUSES = {
  OK: 'ok',
  ERROR: 'error',
} as const;

export type PushNotificationExpoStatus =
  (typeof PUSH_NOTIFICATION_EXPO_STATUSES)[keyof typeof PUSH_NOTIFICATION_EXPO_STATUSES];
