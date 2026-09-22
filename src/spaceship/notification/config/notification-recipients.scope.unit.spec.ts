import {
  notificationRecipientsScope,
  NotificationRecipientsScopeConfig,
} from './notification-recipients.scope';

const validate = (
  raw: Record<string, unknown>,
): NotificationRecipientsScopeConfig => {
  if (!notificationRecipientsScope.validate) {
    throw new Error('notificationRecipients scope has no validator');
  }
  return notificationRecipientsScope.validate(raw);
};

describe('notificationRecipientsScope', () => {
  it('splits a comma-separated list into addresses', () => {
    expect(
      validate({ employeeEmails: 'first@example.com,second@example.com' }),
    ).toEqual({
      employeeEmails: ['first@example.com', 'second@example.com'],
    });
  });

  it('tolerates whitespace around each address', () => {
    expect(
      validate({ employeeEmails: ' first@example.com , second@example.com ' }),
    ).toEqual({
      employeeEmails: ['first@example.com', 'second@example.com'],
    });
  });

  it('drops empty entries left by a trailing or doubled comma', () => {
    expect(validate({ employeeEmails: 'first@example.com,,' })).toEqual({
      employeeEmails: ['first@example.com'],
    });
  });

  // Blank is a valid configuration and means "notify nobody": the processor
  // logs a warning and returns, so an unconfigured template still boots and
  // still serves POST /spaceships.
  it('accepts a blank value as an empty recipient list', () => {
    expect(validate({ employeeEmails: '' })).toEqual({ employeeEmails: [] });
  });

  it('accepts an unset variable as an empty recipient list', () => {
    expect(validate({})).toEqual({ employeeEmails: [] });
  });

  // A typo here would otherwise reach the email provider as a recipient and
  // fail in the background job, where nobody is looking.
  it('refuses an address that is not an email', () => {
    expect(() =>
      validate({ employeeEmails: 'first@example.com,not-an-email' }),
    ).toThrow(/employeeEmails/);
  });
});
