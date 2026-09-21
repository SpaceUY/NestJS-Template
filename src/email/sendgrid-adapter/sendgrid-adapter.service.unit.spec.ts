import * as sgMail from '@sendgrid/mail';
import { EMAIL_ERRORS, EmailError } from '../abstract/email.error';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { LogInput } from '../../common/observability/logger/abstract/logger.interfaces';
import { SendgridAdapterService } from './sendgrid-adapter.service';

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
  sendMultiple: jest.fn(),
}));

const mocked = sgMail as jest.Mocked<typeof sgMail>;

class RecordingLogger extends LoggerService {
  readonly lines: LogInput[] = [];
  setContext(): void {}
  log(input: LogInput): void {
    this.lines.push(input);
  }

  warn(): void {}
  error(input: LogInput): void {
    this.lines.push(input);
  }

  debug(input: LogInput): void {
    this.lines.push(input);
  }
}

const config = {
  emailFrom: 'noreply@example.com',
  sendgridApiKey: 'SG.a-sendgrid-api-key',
};

const response = [
  { statusCode: 202, body: {}, headers: { 'x-message-id': 'sg-id' } },
] as unknown as Awaited<ReturnType<typeof sgMail.send>>;

describe('SendgridAdapterService', () => {
  let logger: RecordingLogger;

  const build = (): SendgridAdapterService => {
    const service = new SendgridAdapterService(config);
    logger = new RecordingLogger();
    service.setLogger(logger);
    return service;
  };

  const content = { html: '<p>hi</p>' };

  beforeEach(() => {
    jest.clearAllMocks();
    mocked.send.mockResolvedValue(response);
    mocked.sendMultiple.mockResolvedValue(response);
  });

  it('hands the api key to the provider client at construction', () => {
    build();

    expect(mocked.setApiKey).toHaveBeenCalledWith('SG.a-sendgrid-api-key');
  });

  describe('sendEmail', () => {
    it('sends the rendered html with the configured sender', async () => {
      const mailingResponse = await build().sendEmail({
        to: 'astro@example.com',
        subject: 'Welcome',
        content,
      });

      expect(mocked.send).toHaveBeenCalledWith({
        to: 'astro@example.com',
        from: 'noreply@example.com',
        subject: 'Welcome',
        html: '<p>hi</p>',
      });
      expect(mailingResponse).toEqual({
        statusCode: 202,
        body: {},
        headers: { 'x-message-id': 'sg-id' },
      });
    });

    it('prefers the per-call sender and defaults a missing subject', async () => {
      await build().sendEmail({
        to: 'astro@example.com',
        from: 'billing@example.com',
        content,
      });

      expect(mocked.send).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'billing@example.com', subject: '' }),
      );
    });

    // This adapter has no template path — executeHtmlEmailSend refuses before
    // the provider is ever called.
    it('refuses a template-only payload with INVALID_PARAMS', async () => {
      const service = build();

      await expect(
        service.sendEmail({
          to: 'astro@example.com',
          content: { templateId: 'd-123' } as never,
        }),
      ).rejects.toMatchObject({ code: EMAIL_ERRORS.INVALID_PARAMS });
      expect(mocked.send).not.toHaveBeenCalled();
    });

    // Rule: a caller never sees the provider's own error (T3).
    it('translates a provider failure into EmailError', async () => {
      mocked.send.mockRejectedValue(new Error('401 Unauthorized'));

      const service = build();
      const failure = service.sendEmail({
        to: 'astro@example.com',
        content,
      });

      await expect(failure).rejects.toBeInstanceOf(EmailError);
      await expect(failure).rejects.toMatchObject({
        code: EMAIL_ERRORS.PROVIDER_REJECTED,
      });
    });

    // Root rule 4: no credential in a log line, on any path.
    it('never writes the api key into a log line', async () => {
      const service = build();
      await service.sendEmail({ to: 'astro@example.com', content });

      expect(JSON.stringify(logger.lines)).not.toContain(
        'SG.a-sendgrid-api-key',
      );
    });
  });

  describe('sendEmailBatch', () => {
    // sendMultiple, not send: SendGrid's send would expose every address to
    // every recipient.
    it('uses the provider batch call for multiple recipients', async () => {
      await build().sendEmailBatch({
        to: ['a@example.com', 'b@example.com'],
        from: 'noreply@example.com',
        subject: 'Launch',
        content,
      });

      expect(mocked.sendMultiple).toHaveBeenCalledWith({
        to: ['a@example.com', 'b@example.com'],
        from: 'noreply@example.com',
        subject: 'Launch',
        html: '<p>hi</p>',
      });
      expect(mocked.send).not.toHaveBeenCalled();
    });

    it('logs the recipient count rather than the recipients', async () => {
      const service = build();
      await service.sendEmailBatch({
        to: ['a@example.com', 'b@example.com'],
        from: 'noreply@example.com',
        content,
      });

      const success = logger.lines.find(
        (line) => line.message === 'SendGrid batch email sent',
      );
      expect(success?.data).toEqual({ statusCode: 202, count: 2 });
    });

    it('translates a provider failure into EmailError', async () => {
      mocked.sendMultiple.mockRejectedValue(new Error('429 Too Many Requests'));

      const service = build();
      await expect(
        service.sendEmailBatch({
          to: ['a@example.com'],
          from: 'noreply@example.com',
          content,
        }),
      ).rejects.toMatchObject({ code: EMAIL_ERRORS.PROVIDER_REJECTED });
    });
  });
});
