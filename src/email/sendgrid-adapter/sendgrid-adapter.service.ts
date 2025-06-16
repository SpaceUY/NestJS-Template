import { Inject, Injectable } from "@nestjs/common";
import { EmailService } from "../abstract/email.service";
import {
  MailingResponse,
  SendRenderedEmailParams,
  SendRenderedEmailMultipleParams,
} from "../abstract/email.interface";
import { SENDGRID_ADAPTER_PROVIDER_CONFIG } from "./sendgrid-adapter-config-provider.const";
import { SendgridAdapterConfig } from "./sendgrid-adapter-config.interface";
import * as sgMail from "@sendgrid/mail";
import { ClientResponse } from "@sendgrid/mail";
import { EmailTemplateService } from "../abstract/templates.abstract";

@Injectable()
export class SendgridAdapterService extends EmailService {
  private emailFrom: string;

  constructor(
    @Inject(SENDGRID_ADAPTER_PROVIDER_CONFIG)
    config: SendgridAdapterConfig,
    protected readonly templateService: EmailTemplateService,
  ) {
    super(templateService);
    this.emailFrom = config.emailFrom;
    sgMail.setApiKey(config.sendgridApiKey);
  }

  private async sendHTML(
    to: string,
    html: string,
    options: Pick<SendRenderedEmailParams, "from" | "subject">,
  ): Promise<ClientResponse> {
    options.from = options.from || this.emailFrom;
    options.subject = options.subject || "";
    return sgMail
      .send({
        to,
        from: options.from,
        subject: options.subject,
        html,
      })
      .then((resp) => resp[0]);
  }

  private async sendTemplate(
    to: string,
    templateId: string,
    locals: Record<string, any>,
    options: Pick<SendRenderedEmailParams, "from" | "subject">,
  ): Promise<ClientResponse> {
    options.from = options.from || this.emailFrom;
    options.subject = options.subject || "";
    return sgMail
      .send({
        to,
        from: options.from,
        subject: options.subject,
        templateId,
        dynamicTemplateData: locals,
      })
      .then((resp) => resp[0]);
  }

  private async sendMultipleTemplate(
    to: string[],
    templateId: string,
    locals: Record<string, any>,
    options: Pick<SendRenderedEmailParams, "from" | "subject">,
  ): Promise<ClientResponse> {
    options.from = options.from || this.emailFrom;
    options.subject = options.subject || "";
    return sgMail
      .sendMultiple({
        to,
        from: options.from,
        subject: options.subject,
        templateId,
        dynamicTemplateData: locals,
      })
      .then((resp) => resp[0]);
  }

  private async sendMultipleHTML(
    to: string[],
    html: string,
    options: Pick<SendRenderedEmailParams, "from" | "subject">,
  ): Promise<ClientResponse> {
    options.from = options.from || this.emailFrom;
    options.subject = options.subject || "";
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
        response = await this.sendTemplate(
          params.to,
          params.content.templateId,
          params.content.params,
          {
            from: params.from,
            subject: params.subject,
          },
        );
      }

      return {
        statusCode: response.statusCode,
        body: response.body,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      // TODO: Integrate log provider
      console.log(`Failed to send email:`, `Error: ${error}`);
      throw error;
    }
  }

  async sendEmailMultiple(
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
        response = await this.sendMultipleTemplate(
          params.to,
          params.content.templateId,
          params.content.params,
          {
            from: params.from,
            subject: params.subject,
          },
        );
      }

      return response;
    } catch (error) {
      // TODO: Integrate log provider
      console.log(`Failed to send multiple emails:`, `Error: ${error}`);
      throw error;
    }
  }
}
