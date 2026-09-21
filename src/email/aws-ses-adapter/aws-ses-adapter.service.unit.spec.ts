import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { LogInput } from '../../common/observability/logger/abstract/logger.interfaces';
import { AwsSesAdapterService } from './aws-ses-adapter.service';

const send = jest.fn();

jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn().mockImplementation(() => ({
    send: (...args: unknown[]) => send(...args),
  })),
  SendEmailCommand: jest
    .fn()
    .mockImplementation((input: unknown) => ({ input })),
}));

const MockedSESClient = SESClient as unknown as jest.Mock;
const MockedSendEmailCommand = SendEmailCommand as unknown as jest.Mock;

class RecordingLogger extends LoggerService {
  readonly errors: LogInput[] = [];
  setContext(): void {}
  log(): void {}
  warn(): void {}
  error(input: LogInput): void {
    this.errors.push(input);
  }

  debug(): void {}
}

const config = {
  fromEmail: 'noreply@example.com',
  accessKeyId: 'AKIAEXAMPLE',
  secretAccessKey: 'a-secret-access-key',
  region: 'us-east-1',
};

describe('AwsSesAdapterService', () => {
  let logger: RecordingLogger;

  const build = (): AwsSesAdapterService => {
    const service = new AwsSesAdapterService(config);
    logger = new RecordingLogger();
    service.setLogger(logger);
    return service;
  };

  const content = { html: '<p>hi</p>' };
  const ok = { $metadata: { httpStatusCode: 200 }, MessageId: 'ses-id' };

  beforeEach(() => {
    jest.clearAllMocks();
    send.mockResolvedValue(ok);
  });

  it('builds its client from the adapter credentials and region', () => {
    build();

    expect(MockedSESClient).toHaveBeenCalledWith({
      credentials: {
        accessKeyId: 'AKIAEXAMPLE',
        secretAccessKey: 'a-secret-access-key',
      },
      region: 'us-east-1',
    });
  });

  describe('sendEmail', () => {
    it('builds the SES command from the rendered html', async () => {
      const response = await build().sendEmail({
        to: 'astro@example.com',
        subject: 'Welcome',
        content,
      });

      expect(MockedSendEmailCommand).toHaveBeenCalledWith({
        Source: 'noreply@example.com',
        Destination: { ToAddresses: ['astro@example.com'] },
        Message: {
          Subject: { Data: 'Welcome' },
          Body: { Html: { Data: '<p>hi</p>' } },
        },
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(ok);
    });

    it('prefers the per-call sender over the configured one', async () => {
      await build().sendEmail({
        to: 'astro@example.com',
        from: 'billing@example.com',
        content,
      });

      const [input] = MockedSendEmailCommand.mock.calls[0] as [
        { Source: string; Message: { Subject: { Data: string } } },
      ];
      expect(input.Source).toBe('billing@example.com');
      // SES rejects an undefined subject, so the adapter sends an empty one.
      expect(input.Message.Subject.Data).toBe('');
    });

    // This adapter has no template path: it sends HTML or it refuses.
    it('rejects a payload with no html rather than sending an empty body', async () => {
      await expect(
        build().sendEmail({ to: 'astro@example.com', content: {} as never }),
      ).rejects.toThrow('HTML content is required to use AWS SES');
      expect(send).not.toHaveBeenCalled();
    });

    it('logs and rethrows when SES fails', async () => {
      send.mockRejectedValue(new Error('Throttling'));

      const service = build();
      await expect(
        service.sendEmail({ to: 'astro@example.com', content }),
      ).rejects.toThrow('Throttling');
      expect(logger.errors).toHaveLength(1);
    });

    // Root rule 4: a log line never carries a credential.
    it('never writes the AWS secret into the failure log', async () => {
      send.mockRejectedValue(new Error('Throttling'));

      const service = build();
      await expect(
        service.sendEmail({ to: 'astro@example.com', content }),
      ).rejects.toThrow();
      expect(JSON.stringify(logger.errors)).not.toContain(
        'a-secret-access-key',
      );
    });

    // $metadata.httpStatusCode is optional in the SDK types; a missing status
    // must not read as a success to the caller.
    it('reports 500 when SES answers without a status code', async () => {
      send.mockResolvedValue({ $metadata: {} });

      const response = await build().sendEmail({
        to: 'astro@example.com',
        content,
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('sendEmailBatch', () => {
    it('sends every recipient in one command', async () => {
      const response = await build().sendEmailBatch({
        to: ['a@example.com', 'b@example.com'],
        from: 'noreply@example.com',
        subject: 'Launch',
        content,
      });

      const [input] = MockedSendEmailCommand.mock.calls[0] as [
        { Destination: { ToAddresses: string[] } },
      ];
      expect(input.Destination.ToAddresses).toEqual([
        'a@example.com',
        'b@example.com',
      ]);
      expect(response.statusCode).toBe(200);
    });

    it('logs and rethrows when SES fails', async () => {
      send.mockRejectedValue(new Error('Throttling'));

      const service = build();
      await expect(
        service.sendEmailBatch({
          to: ['a@example.com'],
          from: 'noreply@example.com',
          content,
        }),
      ).rejects.toThrow('Throttling');
      expect(logger.errors).toHaveLength(1);
    });
  });
});
