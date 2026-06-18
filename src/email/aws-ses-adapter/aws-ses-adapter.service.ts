import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../abstract/email.service';
import {
  MailingResponse,
  SendRenderedEmailParams,
  SendRenderedEmailMultipleParams,
} from '../abstract/email.interface';
import { AwsSesAdapterConfig } from './aws-ses-adapter-config.interface';
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandOutput,
} from '@aws-sdk/client-ses';

@Injectable()
export class AwsSesAdapterService extends EmailService {
  private readonly logger = new Logger(this.constructor.name, {
    timestamp: true,
  });

  private readonly fromEmail: string;

  private readonly sesClient: SESClient;

  constructor(config: AwsSesAdapterConfig) {
    super();
    this.fromEmail = config.fromEmail;
    this.sesClient = new SESClient({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      region: config.region,
    });
  }

  private async sendHTML(
    to: string | string[],
    html: string,
    options: Pick<SendRenderedEmailParams, 'from' | 'subject'>,
  ): Promise<SendEmailCommandOutput> {
    const from = options.from || this.fromEmail;
    const subject = options.subject || '';
    const toAddresses = Array.isArray(to) ? to : [to];

    const command = new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: toAddresses },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: html },
        },
      },
    });
    return await this.sesClient.send(command);
  }

  private async sendWithHtmlContent(
    params: {
      to: string | string[];
      from?: string;
      subject?: string;
      content: { html?: string };
    },
    failureLogMessage: string,
  ): Promise<MailingResponse> {
    try {
      if (!params.content.html) {
        throw new Error('HTML content is required to use AWS SES');
      }

      const response = await this.sendHTML(params.to, params.content.html, {
        from: params.from,
        subject: params.subject,
      });

      return {
        statusCode: response.$metadata.httpStatusCode || 500,
        body: response,
        headers: {},
      };
    } catch (error) {
      this.logger.error(failureLogMessage, error);
      throw error;
    }
  }

  async sendEmail(params: SendRenderedEmailParams): Promise<MailingResponse> {
    return this.sendWithHtmlContent(params, 'Failed to send email:');
  }

  async sendEmailBatch(
    params: SendRenderedEmailMultipleParams,
  ): Promise<MailingResponse> {
    return this.sendWithHtmlContent(params, 'Failed to send multiple emails:');
  }
}
