import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../abstract/email.service';
import {
  MailingResponse,
  RenderedEmailContent,
  SendRenderedEmailMultipleParams,
  SendRenderedEmailParams,
} from '../abstract/email.interface';
import { ConsoleAdapterConfig } from './console-adapter-config.interface';

@Injectable()
export class ConsoleAdapterService extends EmailService {
  private readonly logger = new Logger(this.constructor.name, {
    timestamp: true,
  });

  private readonly defaultFrom?: string;

  constructor(config: ConsoleAdapterConfig = {}) {
    super();
    this.defaultFrom = this.resolveDefaultFrom(config);
  }

  private sendMock(
    params: {
      to: string | string[];
      from?: string;
      subject?: string;
      content: RenderedEmailContent;
    },
    logMessage: string,
    resultMessage: string,
  ): MailingResponse {
    const html = this.resolveHtmlContent(params.content);
    const from = params.from || this.defaultFrom;

    const payload = {
      to: params.to,
      from,
      subject: params.subject,
      content: {
        ...params.content,
        html,
      },
    };

    this.logger.log(
      `${logMessage}\n${JSON.stringify(payload, null, 2)}`,
    );

    return {
      statusCode: 200,
      body: {
        delivered: false,
        provider: 'console',
        message: resultMessage,
      },
      headers: {},
    };
  }

  async sendEmail(params: SendRenderedEmailParams): Promise<MailingResponse> {
    return this.sendMock(
      params,
      'Mock email delivery (console adapter):',
      'Email was printed to logs, not delivered.',
    );
  }

  async sendEmailBatch(
    params: SendRenderedEmailMultipleParams,
  ): Promise<MailingResponse> {
    return this.sendMock(
      params,
      'Mock email batch delivery (console adapter):',
      'Batch email was printed to logs, not delivered.',
    );
  }

  private resolveHtmlContent(content: RenderedEmailContent): string {
    if (content.html) {
      return content.html;
    }

    throw new Error('`content.html` is required by ConsoleAdapterService');
  }

  private resolveDefaultFrom(config: ConsoleAdapterConfig): string | undefined {
    if (!config.fromEmail) {
      return undefined;
    }

    if (config.fromName) {
      return `${config.fromName} <${config.fromEmail}>`;
    }

    return config.fromEmail;
  }
}
