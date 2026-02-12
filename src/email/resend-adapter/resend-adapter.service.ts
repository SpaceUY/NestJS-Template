import { Inject, Injectable } from '@nestjs/common';
import { EmailService } from '../abstract/email.service';
import {
  MailingResponse,
  SendRenderedEmailParams,
  SendRenderedEmailMultipleParams,
} from '../abstract/email.interface';
import { RESEND_ADAPTER_PROVIDER_CONFIG } from './resend-adapter-config-provider.const';
import { ResendAdapterConfig } from './resend-adapter-config.interface';
import { CreateBatchResponse, CreateEmailResponse, Resend } from 'resend';
import { EmailLogger, EMAIL_LOGGER } from '../abstract/email-logger.interface';
import { EmailError, EmailErrorCode } from '../abstract/email-error';

@Injectable()
export class ResendAdapterService extends EmailService {
  private emailFrom: string;
  private resend: Resend;
  private logger: EmailLogger;

  constructor(
    @Inject(RESEND_ADAPTER_PROVIDER_CONFIG)
    config: ResendAdapterConfig,
    @Inject(EMAIL_LOGGER) logger: EmailLogger,
  ) {
    super();
    this.emailFrom = config.emailFrom;
    this.resend = new Resend(config.resendApiKey);
    this.logger = logger;
  }

  private async sendHTML(
    to: string,
    html: string,
    options: Pick<SendRenderedEmailParams, 'from' | 'subject'>,
  ): Promise<CreateEmailResponse> {
    const from = options.from || this.emailFrom;
    const subject = options.subject || '';
    this.logger.debug?.('Resend sending HTML', { to, from, subject });
    return this.resend.emails.send({
      from,
      to,
      subject,
      html,
    });
  }

  private async sendEmailBatchHTML(
    to: string[],
    html: string,
    options: Pick<SendRenderedEmailParams, 'from' | 'subject'>,
  ): Promise<CreateBatchResponse> {
    this.logger.debug?.('Resend sending batch HTML', {
      toCount: to.length,
      from: options.from,
      subject: options.subject,
    });
    const response = await this.resend.batch.send(
      to.map((recipient) => ({
        from: options.from!,
        to: [recipient],
        subject: options.subject!,
        html,
      })),
    );

    return response;
  }

  async sendEmail(params: SendRenderedEmailParams): Promise<MailingResponse> {
    try {
      let response: CreateEmailResponse;
      if (params.content.html) {
        response = await this.sendHTML(params.to, params.content.html, {
          from: params.from,
          subject: params.subject,
        });
      } else {
        throw new EmailError(
          'Template-based sending is not supported by this adapter. Provide HTML content.',
          EmailErrorCode.InvalidParams,
        );
      }

      const mailingResponse: MailingResponse = {
        statusCode: response.error ? 500 : 200,
        body: response,
        headers: {},
      };
      this.logger.info?.('Resend email sent', {
        statusCode: mailingResponse.statusCode,
      });
      return mailingResponse;
    } catch (error: unknown) {
      this.logger.error?.('Resend sendEmail failed', {
        error: String(error),
      });
      throw new EmailError(
        'Failed to send email',
        EmailErrorCode.ProviderRejected,
        error,
      );
    }
  }

  async sendEmailBatch(
    params: SendRenderedEmailMultipleParams,
  ): Promise<MailingResponse> {
    try {
      let response: CreateBatchResponse;
      if (params.content.html) {
        response = await this.sendEmailBatchHTML(
          params.to,
          params.content.html,
          {
            from: params.from,
            subject: params.subject,
          },
        );
      } else {
        throw new EmailError(
          'Template-based batch sending is not supported by this adapter. Provide HTML content.',
          EmailErrorCode.InvalidParams,
        );
      }

      const mailingResponse: MailingResponse = {
        statusCode: response.error ? 500 : 200,
        body: response,
        headers: {},
      };
      this.logger.info?.('Resend batch email sent', {
        statusCode: mailingResponse.statusCode,
        count: params.to.length,
      });
      return mailingResponse;
    } catch (error: unknown) {
      this.logger.error?.('Resend sendEmailBatch failed', {
        error: String(error),
        count: params.to.length,
      });
      throw new EmailError(
        'Failed to send multiple emails',
        EmailErrorCode.ProviderRejected,
        error,
      );
    }
  }
}
