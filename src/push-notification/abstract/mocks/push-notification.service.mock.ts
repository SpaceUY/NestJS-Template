import {
  PushNotificationService,
  PUSH_NOTIFICATION_STATUSES,
} from '../push-notification.service';

export class MockPushNotificationService extends PushNotificationService {
  sendPushNotification = jest.fn().mockResolvedValue({
    id: 'notification-id',
    status: PUSH_NOTIFICATION_STATUSES.SUCCESS,
  });

  sendPushNotificationInChunks = jest.fn().mockResolvedValue({
    successNotifications: [],
    errorNotifications: [],
  });
}
