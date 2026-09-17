import { Test, TestingModule } from '@nestjs/testing';
import { ConfigNotificationRecipientsProvider } from './config-notification-recipients.provider';
import { notificationRecipientsScope } from './config/notification-recipients.scope';

describe('ConfigNotificationRecipientsProvider', () => {
  let provider: ConfigNotificationRecipientsProvider;

  const mockConfig = {
    employeeEmails: ['a@spacedev.io', 'b@spacedev.io'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigNotificationRecipientsProvider,
        { provide: notificationRecipientsScope.KEY, useValue: mockConfig },
      ],
    }).compile();

    provider = module.get<ConfigNotificationRecipientsProvider>(
      ConfigNotificationRecipientsProvider,
    );
  });

  it('returns the employee emails configured via the notification recipients scope', async () => {
    const result = await provider.getRecipients();

    expect(result).toEqual(mockConfig.employeeEmails);
  });
});
