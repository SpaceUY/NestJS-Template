import { Inject, Injectable } from '@nestjs/common';
import { NotificationRecipientsProvider } from './notification-recipients.provider';
import {
  notificationRecipientsScope,
  NotificationRecipientsScopeConfig,
} from './config/notification-recipients.scope';

@Injectable()
export class ConfigNotificationRecipientsProvider extends NotificationRecipientsProvider {
  constructor(
    @Inject(notificationRecipientsScope.KEY)
    private readonly config: NotificationRecipientsScopeConfig,
  ) {
    super();
  }

  async getRecipients(): Promise<string[]> {
    return this.config.employeeEmails;
  }
}
