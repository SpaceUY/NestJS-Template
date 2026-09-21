import { EMAIL_ERRORS, EmailError } from '../abstract/email.error';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { MailingResponse } from '../abstract/email.interface';
import { executeHtmlEmailSend } from './execute-html-email-send';

describe('executeHtmlEmailSend', () => {
  const logger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
  } as unknown as LoggerService;

  const response: MailingResponse = { statusCode: 200, body: {}, headers: {} };

  const options = (
    overrides: Partial<Parameters<typeof executeHtmlEmailSend>[0]> = {},
  ): Parameters<typeof executeHtmlEmailSend<unknown>>[0] => ({
    content: { html: '<p>hi</p>' },
    invalidContentMessage: 'HTML content is required',
    providerErrorMessage: 'Failed to send email',
    logger,
    successLogMessage: 'sent',
    failureLogMessage: 'send failed',
    send: jest.fn().mockResolvedValue({ id: 'provider-id' }),
    toMailingResponse: () => response,
    ...overrides,
  });

  afterEach(() => jest.clearAllMocks());

  it('sends the html and returns the mapped response', async () => {
    const send = jest.fn().mockResolvedValue({ id: 'provider-id' });

    await expect(executeHtmlEmailSend(options({ send }))).resolves.toBe(
      response,
    );
    expect(send).toHaveBeenCalledWith('<p>hi</p>');
  });

  it('refuses a content object with no html, without calling the provider', async () => {
    const send = jest.fn();

    const error = (await executeHtmlEmailSend(
      options({ content: { html: '' }, send }),
    ).catch((e: unknown) => e)) as EmailError;

    expect(error).toBeInstanceOf(EmailError);
    expect(error.code).toBe(EMAIL_ERRORS.INVALID_PARAMS);
    expect(error.message).toBe('HTML content is required');
    expect(send).not.toHaveBeenCalled();
  });

  it('logs the success line with the caller metadata', async () => {
    await executeHtmlEmailSend(
      options({ successMeta: (r) => ({ statusCode: r.statusCode }) }),
    );

    expect(logger.log).toHaveBeenCalledWith({
      message: 'sent',
      data: { statusCode: 200 },
    });
  });

  describe('when the provider rejects', () => {
    const rejecting = (): Parameters<typeof executeHtmlEmailSend<unknown>>[0] =>
      options({
        send: jest.fn().mockRejectedValue(new Error('provider is down')),
        failureMeta: { count: 3 },
      });

    it('translates the failure into PROVIDER_REJECTED', async () => {
      const error = (await executeHtmlEmailSend(rejecting()).catch(
        (e: unknown) => e,
      )) as EmailError;

      expect(error).toBeInstanceOf(EmailError);
      expect(error.code).toBe(EMAIL_ERRORS.PROVIDER_REJECTED);
      expect(error.message).toBe('Failed to send email');
    });

    it('keeps the provider text as `cause` data rather than as the message', async () => {
      const error = (await executeHtmlEmailSend(rejecting()).catch(
        (e: unknown) => e,
      )) as EmailError;

      expect(error.data).toEqual({ cause: 'Error: provider is down' });
    });

    it('logs the failure with the caller metadata', async () => {
      await executeHtmlEmailSend(rejecting()).catch(() => undefined);

      expect(logger.error).toHaveBeenCalledWith({
        message: 'send failed',
        data: { count: 3, error: 'Error: provider is down' },
      });
    });
  });
});
