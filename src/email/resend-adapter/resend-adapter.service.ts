import { Injectable } from '@nestjs/common';
import { EmailService } from '../abstract/email.service';
import {
  MailingResponse,
  SendRenderedEmailParams,
  SendRenderedEmailMultipleParams,
} from '../abstract/email.interface';
import { ResendAdapterConfig } from './resend-adapter-config.interface';
import { CreateBatchResponse, CreateEmailResponse, Resend } from 'resend';
import { EmailLogger } from '../abstract/email-logger.interface';
import { createDefaultEmailLogger } from '../utils/email-logger.adapter';
import { executeHtmlEmailSend } from '../utils/execute-html-email-send';

@Injectable()
export class ResendAdapterService extends EmailService {
  private emailFrom: string;
  private resend: Resend;
  private logger: EmailLogger;

  constructor(config: ResendAdapterConfig, logger?: EmailLogger) {
    super();
    this.emailFrom = config.emailFrom;
    this.resend = new Resend(config.resendApiKey);
    this.logger = logger || createDefaultEmailLogger();
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
    const from = options.from || this.emailFrom;
    const subject = options.subject || '';

    this.logger.debug?.('Resend sending batch HTML', {
      toCount: to.length,
      from,
      subject,
    });
    const response = await this.resend.batch.send(
      to.map((recipient) => ({
        from,
        to: [recipient],
        subject,
        html,
      })),
    );

    return response;
  }

  private toMailingResponse(
    response: CreateEmailResponse | CreateBatchResponse,
  ): MailingResponse {
    return {
      statusCode: response.error ? 500 : 200,
      body: response,
      headers: {},
    };
  }

  async sendEmail(params: SendRenderedEmailParams): Promise<MailingResponse> {
    return executeHtmlEmailSend({
      content: params.content,
      invalidContentMessage:
        'Template-based sending is not supported by this adapter. Provide HTML content.',
      providerErrorMessage: 'Failed to send email',
      logger: this.logger,
      successLogMessage: 'Resend email sent',
      successMeta: (mailingResponse) => ({
        statusCode: mailingResponse.statusCode,
      }),
      failureLogMessage: 'Resend sendEmail failed',
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
      successLogMessage: 'Resend batch email sent',
      successMeta: (mailingResponse) => ({
        statusCode: mailingResponse.statusCode,
        count: params.to.length,
      }),
      failureLogMessage: 'Resend sendEmailBatch failed',
      failureMeta: { count: params.to.length },
      send: (html) =>
        this.sendEmailBatchHTML(params.to, html, {
          from: params.from,
          subject: params.subject,
        }),
      toMailingResponse: (response) => this.toMailingResponse(response),
    });
  }
}
