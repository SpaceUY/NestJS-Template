import { Injectable } from '@nestjs/common';
import { EmailService } from '../abstract/email.service';
import {
  MailingResponse,
  SendRenderedEmailParams,
  SendRenderedEmailMultipleParams,
} from '../abstract/email.interface';
import { SendgridAdapterConfig } from './sendgrid-adapter-config.interface';
import * as sgMail from '@sendgrid/mail';
import { ClientResponse } from '@sendgrid/mail';
import { EmailLogger } from '../abstract/email-logger.interface';
import { createDefaultEmailLogger } from '../utils/email-logger.adapter';
import { executeHtmlEmailSend } from '../utils/execute-html-email-send';

@Injectable()
export class SendgridAdapterService extends EmailService {
  private emailFrom: string;
  private logger: EmailLogger;

  constructor(config: SendgridAdapterConfig, logger?: EmailLogger) {
    super();
    this.emailFrom = config.emailFrom;
    this.logger = logger || createDefaultEmailLogger();
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

  private toMailingResponse(response: ClientResponse): MailingResponse {
    return {
      statusCode: response.statusCode,
      body: response.body,
      headers: response.headers as Record<string, string>,
    };
  }

  async sendEmail(params: SendRenderedEmailParams): Promise<MailingResponse> {
    return executeHtmlEmailSend({
      content: params.content,
      invalidContentMessage:
        'Template-based sending is not supported by this adapter. Provide HTML content.',
      providerErrorMessage: 'Failed to send email',
      logger: this.logger,
      successLogMessage: 'SendGrid email sent',
      successMeta: (mailingResponse) => ({
        statusCode: mailingResponse.statusCode,
      }),
      failureLogMessage: 'SendGrid sendEmail failed',
      send: (html) =>
        this.sendHTML(params.to, html, {
          from: params.from,
          subject: params.subject,
        }),
      toMailingResponse: (response) => this.toMailingResponse(response),
    });
  }

  async sendEmailBatch(
    params: SendRenderedEmailMultipleParams,
  ): Promise<MailingResponse> {
    return executeHtmlEmailSend({
      content: params.content,
      invalidContentMessage:
        'Template-based batch sending is not supported by this adapter. Provide HTML content.',
      providerErrorMessage: 'Failed to send multiple emails',
      logger: this.logger,
      successLogMessage: 'SendGrid batch email sent',
      successMeta: (mailingResponse) => ({
        statusCode: mailingResponse.statusCode,
        count: params.to.length,
      }),
      failureLogMessage: 'SendGrid sendEmailBatch failed',
      failureMeta: { count: params.to.length },
      send: (html) =>
        this.sendMultipleHTML(params.to, html, {
          from: params.from,
          subject: params.subject,
        }),
      toMailingResponse: (response) => this.toMailingResponse(response),
    });
  }
}
