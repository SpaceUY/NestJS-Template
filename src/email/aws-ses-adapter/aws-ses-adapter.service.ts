import { Inject, Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../abstract/email.service';
import {
  MailingResponse,
  SendRenderedEmailParams,
  SendRenderedEmailMultipleParams,
} from '../abstract/email.interface';
import { AWS_SES_ADAPTER_PROVIDER_CONFIG } from './aws-ses-adapter-config-provider.const';
import { AwsSesAdapterConfig } from './aws-ses-adapter-config.interface';
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandOutput,
} from '@aws-sdk/client-ses';
import { EmailTemplateService } from '../abstract/templates.abstract';

@Injectable()
export class AwsSesAdapterService extends EmailService {
  private readonly logger = new Logger(this.constructor.name, {
    timestamp: true,
  });

  private readonly fromEmail: string;

  private readonly sesClient: SESClient;

  constructor(
    @Inject(AWS_SES_ADAPTER_PROVIDER_CONFIG)
    config: AwsSesAdapterConfig,
    protected readonly templateService: EmailTemplateService,
  ) {
    super(templateService);
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
  ): Promise<SendEmailCommandOutput>  {
    const from = options.from || this.fromEmail;
    const subject = options.subject || '';
    const command = new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [...to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: html },
        },
      },
    });
    return await this.sesClient.send(command);
  }

  async sendEmail(
    params: SendRenderedEmailParams,
  ): Promise<MailingResponse> {
    try {
      if (!params.content.html) {
        throw new Error('HTML content is required to use AWS SES');
      }
      let response: SendEmailCommandOutput = await this.sendHTML(params.to, params.content.html, {
        from: params.from,
        subject: params.subject,
      });
      return {
        statusCode: response.$metadata.httpStatusCode || 500,
        body: response,
        headers: {},
      };
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendEmailMultiple(
    params: SendRenderedEmailMultipleParams,
  ): Promise<MailingResponse> {
    try {
      if (!params.content.html) {
        throw new Error('HTML content is required to use AWS SES');
      }
      let response: SendEmailCommandOutput = await this.sendHTML(params.to, params.content.html, {
        from: params.from,
        subject: params.subject,
      });

      return {
        statusCode: response.$metadata.httpStatusCode || 500,
        body: response,
        headers: {},
      };
    } catch (error) {
      // TODO: Integrate log provider
      console.log(`AWS SES: Failed to send multiple emails:`, `Error: ${error}`);
      throw error;
    }
  }
}
