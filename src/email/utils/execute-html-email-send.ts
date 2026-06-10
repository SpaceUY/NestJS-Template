import {
  MailingResponse,
  RenderedEmailContent,
} from '../abstract/email.interface';
import { LoggerService } from '../../common/logger/abstract/logger.service';
import { createEmailError, EmailErrorCode } from '../abstract/email-error';

interface ExecuteHtmlEmailSendOptions<TProviderResponse> {
  content: RenderedEmailContent;
  invalidContentMessage: string;
  providerErrorMessage: string;
  logger: LoggerService;
  successLogMessage: string;
  successMeta?: (mailingResponse: MailingResponse) => Record<string, unknown>;
  failureLogMessage: string;
  failureMeta?: Record<string, unknown>;
  send: (html: string) => Promise<TProviderResponse>;
  toMailingResponse: (providerResponse: TProviderResponse) => MailingResponse;
}

export async function executeHtmlEmailSend<TProviderResponse>(
  options: ExecuteHtmlEmailSendOptions<TProviderResponse>,
): Promise<MailingResponse> {
  if (!options.content.html) {
    throw createEmailError(
      options.invalidContentMessage,
      EmailErrorCode.InvalidParams,
    );
  }

  try {
    const providerResponse = await options.send(options.content.html);
    const mailingResponse = options.toMailingResponse(providerResponse);
    options.logger.log({
      message: options.successLogMessage,
      data: options.successMeta?.(mailingResponse),
    });
    return mailingResponse;
  } catch (error) {
    options.logger.error({
      message: options.failureLogMessage,
      data: { ...options.failureMeta, error: String(error) },
    });
    throw createEmailError(
      options.providerErrorMessage,
      EmailErrorCode.ProviderRejected,
      error,
    );
  }
}
