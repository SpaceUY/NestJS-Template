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
import { EmailTemplateService } from '../abstract/templates.abstract';

@Injectable()
export class ResendAdapterService extends EmailService {
  private emailFrom: string;
  private resend: Resend;

  constructor(
    @Inject(RESEND_ADAPTER_PROVIDER_CONFIG)
    config: ResendAdapterConfig,
    protected readonly templateService: EmailTemplateService,
  ) {
    super(templateService);
    this.emailFrom = config.emailFrom;
    this.resend = new Resend(config.resendApiKey);
  }

  private async sendHTML(
    to: string,
    html: string,
    options: Pick<SendRenderedEmailParams, 'from' | 'subject'>,
  ): Promise<CreateEmailResponse> {
    const from = options.from || this.emailFrom;
    const subject = options.subject || '';
    return this.resend.emails.send({
      from,
      to,
      subject,
      html,
    });
  }

  // Resend doesn't support template IDs like SendGrid. Their system only supports
  // HTML content or React components passed directly in the API call.
  // Broadcasts exist but are for mass campaigns, not individual template rendering.
  private async sendTemplate(
    to: string,
    templateId: string,
    locals: Record<string, unknown>,
    options: Pick<SendRenderedEmailParams, 'from' | 'subject'>,
  ): Promise<CreateEmailResponse> {
    throw new Error(
      'Template ID functionality not supported by Resend provider',
    );
  }

  private async sendEmailBatchTemplate(
    to: string[],
    templateId: string,
    locals: Record<string, unknown>,
    options: Pick<SendRenderedEmailParams, 'from' | 'subject'>,
  ): Promise<CreateBatchResponse> {
    // TODO: Make this a part of set errors for provider
    throw new Error(
      'Template ID functionality not supported by Resend provider',
    );
  }

  private async sendEmailBatchHTML(
    to: string[],
    html: string,
    options: Pick<SendRenderedEmailParams, 'from' | 'subject'>,
  ): Promise<CreateBatchResponse> {
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
        response = await this.sendTemplate(
          params.to,
          params.content.templateId || '',
          params.content.params || {},
          {
            from: params.from,
            subject: params.subject,
          },
        );
      }

      return {
        statusCode: response.error ? 500 : 200,
        body: response,
        headers: {},
      };
    } catch (error: unknown) {
      // TODO: Integrate log provider
      console.log(`Failed to send email:`, `Error: ${error}`);
      throw error;
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
        response = await this.sendEmailBatchTemplate(
          params.to,
          params.content.templateId || '',
          params.content.params || {},
          {
            from: params.from,
            subject: params.subject,
          },
        );
      }

      return {
        statusCode: response.error ? 500 : 200,
        body: response,
        headers: {},
      };
    } catch (error: unknown) {
      // TODO: Integrate log provider
      console.log(`Failed to send multiple emails:`, `Error: ${error}`);
      throw error;
    }
  }
}
