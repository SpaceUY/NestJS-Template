import { Inject, Injectable } from '@nestjs/common';
import { EmailService } from '../abstract/email.service';
import {
  MailingResponse,
  SendRenderedEmailParams,
  SendRenderedEmailMultipleParams,
} from '../abstract/email.interface';
import { SENDGRID_ADAPTER_PROVIDER_CONFIG } from './sendgrid-adapter-config-provider.const';
import { SendgridAdapterConfig } from './sendgrid-adapter-config.interface';
import * as sgMail from '@sendgrid/mail';
import { ClientResponse } from '@sendgrid/mail';
import { EmailLogger, EMAIL_LOGGER } from '../abstract/email-logger.interface';
import { EmailError, EmailErrorCode } from '../abstract/email-error';

@Injectable()
export class SendgridAdapterService extends EmailService {
  private emailFrom: string;
  private logger?: EmailLogger;

  constructor(
    @Inject(SENDGRID_ADAPTER_PROVIDER_CONFIG)
    config: SendgridAdapterConfig,
    @Inject(EMAIL_LOGGER) logger?: EmailLogger,
  ) {
    super();
    this.emailFrom = config.emailFrom;
    this.logger = logger;
    sgMail.setApiKey(config.sendgridApiKey);
  }

  private async sendHTML(
    to: string,
    html: string,
    options: Pick<SendRenderedEmailParams, 'from' | 'subject'>,
  ): Promise<ClientResponse> {
    options.from = options.from || this.emailFrom;
    options.subject = options.subject || '';
    this.logger?.debug?.('SendGrid sending HTML', {
      to,
      from: options.from,
      subject: options.subject,
    });
    return sgMail
      .send({
        to,
        from: options.from,
        subject: options.subject,
        html,
      })
      .then((resp) => resp[0]);
  }

  private async sendMultipleHTML(
    to: string[],
    html: string,
    options: Pick<SendRenderedEmailParams, 'from' | 'subject'>,
  ): Promise<ClientResponse> {
    options.from = options.from || this.emailFrom;
    options.subject = options.subject || '';
    this.logger?.debug?.('SendGrid sending multiple HTML', {
      toCount: to.length,
      from: options.from,
      subject: options.subject,
    });
    return sgMail
      .sendMultiple({
        to,
        from: options.from,
        subject: options.subject,
        html,
      })
      .then((resp) => resp[0]);
  }

  async sendEmail(params: SendRenderedEmailParams): Promise<MailingResponse> {
    try {
      let response: ClientResponse;
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
        statusCode: response.statusCode,
        body: response.body,
        headers: response.headers as Record<string, string>,
      };
      this.logger?.info?.('SendGrid email sent', {
        statusCode: mailingResponse.statusCode,
      });
      return mailingResponse;
    } catch (error) {
      this.logger?.error?.('SendGrid sendEmail failed', {
        error: String(error),
      });
      // Map common provider errors to EmailError codes (best effort)
      const message = 'Failed to send email';
      throw new EmailError(message, EmailErrorCode.ProviderRejected, error);
    }
  }

  async sendEmailBatch(
    params: SendRenderedEmailMultipleParams,
  ): Promise<MailingResponse> {
    try {
      let response: ClientResponse;
      if (params.content.html) {
        response = await this.sendMultipleHTML(params.to, params.content.html, {
          from: params.from,
          subject: params.subject,
        });
      } else {
        throw new EmailError(
          'Template-based batch sending is not supported by this adapter. Provide HTML content.',
          EmailErrorCode.InvalidParams,
        );
      }

      const mailingResponse: MailingResponse = {
        statusCode: response.statusCode,
        body: response.body,
        headers: response.headers as Record<string, string>,
      };
      this.logger?.info?.('SendGrid batch email sent', {
        statusCode: mailingResponse.statusCode,
        count: params.to.length,
      });
      return mailingResponse;
    } catch (error) {
      this.logger?.error?.('SendGrid sendEmailBatch failed', {
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
