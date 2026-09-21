import { Resend } from 'resend';
import { EMAIL_ERRORS, EmailError } from '../abstract/email.error';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { ResendAdapterService } from './resend-adapter.service';

const send = jest.fn();
const batchSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: (...args: unknown[]) => send(...args) },
    batch: { send: (...args: unknown[]) => batchSend(...args) },
  })),
}));

class SilentLogger extends LoggerService {
  setContext(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  debug(): void {}
}

describe('ResendAdapterService', () => {
  const build = (): ResendAdapterService => {
    const service = new ResendAdapterService({
      emailFrom: 'noreply@example.com',
      resendApiKey: 'a-key',
    });
    service.setLogger(new SilentLogger());
    return service;
  };

  const content = { html: '<p>hi</p>' };

  afterEach(() => jest.clearAllMocks());

  it('passes the api key to the provider client', () => {
    build();

    expect(Resend).toHaveBeenCalledWith('a-key');
  });

  describe('sendEmail', () => {
    it('sends the rendered html with the configured sender', async () => {
      send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

      const response = await build().sendEmail({
        to: 'astro@example.com',
        subject: 'Welcome',
        content,
      });

      expect(send).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'astro@example.com',
        subject: 'Welcome',
        html: '<p>hi</p>',
      });
      expect(response.statusCode).toBe(200);
    });

    it('lets the call override the sender and defaults the subject to empty', async () => {
      send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

      await build().sendEmail({
        to: 'astro@example.com',
        from: 'alerts@example.com',
        content,
      });

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'alerts@example.com', subject: '' }),
      );
    });

    // Resend answers 200 with an `error` field rather than rejecting, so the
    // status has to come from the payload.
    it('reports 500 when the provider answers with an error payload', async () => {
      send.mockResolvedValue({ data: null, error: { message: 'rejected' } });

      const response = await build().sendEmail({
        to: 'astro@example.com',
        content,
      });

      expect(response.statusCode).toBe(500);
    });

    it('turns a thrown provider failure into PROVIDER_REJECTED', async () => {
      send.mockRejectedValue(new Error('network down'));

      const error = (await build()
        .sendEmail({ to: 'astro@example.com', content })
        .catch((e: unknown) => e)) as EmailError;

      expect(error).toBeInstanceOf(EmailError);
      expect(error.code).toBe(EMAIL_ERRORS.PROVIDER_REJECTED);
    });

    it('refuses content with no html before touching the provider', async () => {
      const error = (await build()
        .sendEmail({ to: 'astro@example.com', content: { html: '' } })
        .catch((e: unknown) => e)) as EmailError;

      expect(error.code).toBe(EMAIL_ERRORS.INVALID_PARAMS);
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('sendEmailBatch', () => {
    it('sends one message per recipient in a single batch call', async () => {
      batchSend.mockResolvedValue({ data: { data: [] }, error: null });

      await build().sendEmailBatch({
        to: ['a@example.com', 'b@example.com'],
        from: 'noreply@example.com',
        subject: 'Launch',
        content,
      });

      expect(batchSend).toHaveBeenCalledTimes(1);
      expect(batchSend).toHaveBeenCalledWith([
        {
          from: 'noreply@example.com',
          to: ['a@example.com'],
          subject: 'Launch',
          html: '<p>hi</p>',
        },
        {
          from: 'noreply@example.com',
          to: ['b@example.com'],
          subject: 'Launch',
          html: '<p>hi</p>',
        },
      ]);
    });

    it('turns a thrown batch failure into PROVIDER_REJECTED', async () => {
      batchSend.mockRejectedValue(new Error('network down'));

      const error = (await build()
        .sendEmailBatch({
          to: ['a@example.com'],
          from: 'noreply@example.com',
          content,
        })
        .catch((e: unknown) => e)) as EmailError;

      expect(error.code).toBe(EMAIL_ERRORS.PROVIDER_REJECTED);
    });
  });
});
