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

  async sendEmail(params: SendRenderedEmailParams): Promise<MailingResponse> {
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
      `Mock email delivery (console adapter):\n${JSON.stringify(payload, null, 2)}`,
    );

    return {
      statusCode: 200,
      body: {
        delivered: false,
        provider: 'console',
        message: 'Email was printed to logs, not delivered.',
      },
      headers: {},
    };
  }

  async sendEmailBatch(
    params: SendRenderedEmailMultipleParams,
  ): Promise<MailingResponse> {
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
      `Mock email batch delivery (console adapter):\n${JSON.stringify(payload, null, 2)}`,
    );

    return {
      statusCode: 200,
      body: {
        delivered: false,
        provider: 'console',
        message: 'Batch email was printed to logs, not delivered.',
      },
      headers: {},
    };
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
