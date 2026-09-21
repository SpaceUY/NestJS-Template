import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { ConsoleAdapterService } from './console-adapter.service';

/** Records what the adapter logged, standing in for the container logger. */
class RecordingLogger extends LoggerService {
  entries: Array<{ message: string; data?: unknown }> = [];

  setContext(): void {}

  log(input: { message: string; data?: unknown }): void {
    this.entries.push(input);
  }

  warn(): void {}
  error(): void {}
  debug(): void {}
}

describe('ConsoleAdapterService', () => {
  const build = (
    config: { fromEmail?: string; fromName?: string } = {},
  ): { service: ConsoleAdapterService; logger: RecordingLogger } => {
    const service = new ConsoleAdapterService(config);
    const logger = new RecordingLogger();
    service.setLogger(logger);
    return { service, logger };
  };

  const content = { html: '<p>hi</p>' };

  it('answers with a not-delivered result rather than pretending to send', async () => {
    const { service } = build();

    await expect(
      service.sendEmail({ to: 'astro@example.com', content }),
    ).resolves.toEqual({
      statusCode: 200,
      body: {
        delivered: false,
        provider: 'console',
        message: 'Email was printed to logs, not delivered.',
      },
      headers: {},
    });
  });

  it('says so differently for a batch', async () => {
    const { service } = build();

    const response = await service.sendEmailBatch({
      to: ['a@example.com', 'b@example.com'],
      from: 'noreply@example.com',
      content,
    });

    expect(response.body).toMatchObject({
      delivered: false,
      message: 'Batch email was printed to logs, not delivered.',
    });
  });

  // Printing the email it would have sent is this adapter's whole purpose.
  it('prints the payload it would have sent', async () => {
    const { service, logger } = build();

    await service.sendEmail({
      to: 'astro@example.com',
      subject: 'Welcome',
      content,
    });

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0].data).toMatchObject({
      to: 'astro@example.com',
      subject: 'Welcome',
      content: { html: '<p>hi</p>' },
    });
  });

  describe('default sender', () => {
    it('formats name and address together when both are configured', async () => {
      const { service, logger } = build({
        fromEmail: 'noreply@example.com',
        fromName: 'Mission Control',
      });

      await service.sendEmail({ to: 'astro@example.com', content });

      expect(logger.entries[0].data).toMatchObject({
        from: 'Mission Control <noreply@example.com>',
      });
    });

    it('uses the bare address when no name is configured', async () => {
      const { service, logger } = build({ fromEmail: 'noreply@example.com' });

      await service.sendEmail({ to: 'astro@example.com', content });

      expect(logger.entries[0].data).toMatchObject({
        from: 'noreply@example.com',
      });
    });

    it('leaves the sender undefined when nothing is configured', async () => {
      const { service, logger } = build();

      await service.sendEmail({ to: 'astro@example.com', content });

      expect(
        (logger.entries[0].data as { from?: string }).from,
      ).toBeUndefined();
    });

    it('lets the call override the configured sender', async () => {
      const { service, logger } = build({ fromEmail: 'noreply@example.com' });

      await service.sendEmail({
        to: 'astro@example.com',
        from: 'alerts@example.com',
        content,
      });

      expect(logger.entries[0].data).toMatchObject({
        from: 'alerts@example.com',
      });
    });
  });

  it('refuses content with no html', async () => {
    const { service } = build();

    await expect(
      service.sendEmail({ to: 'astro@example.com', content: { html: '' } }),
    ).rejects.toThrow('`content.html` is required by ConsoleAdapterService');
  });
});
