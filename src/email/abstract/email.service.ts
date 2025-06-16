import { EmailTemplateService } from "./templates.abstract";
import {
  MailingResponse,
  RenderedEmailContent,
  RenderEmailTemplateParams,
  SendRenderedEmailParams,
  SendRenderedEmailMultipleParams,
} from "./email.interface";

export abstract class EmailService {
  constructor(protected templateService: EmailTemplateService) {}

  /**
   * Renders an email template with the provided parameters
   */
  async renderTemplate<
    Templates extends Record<string, string>,
    Params extends Record<Templates[keyof Templates], any>,
  >(
    params: RenderEmailTemplateParams<Templates, Params>,
  ): Promise<RenderedEmailContent> {
    if (!this.templateService) {
      throw new Error("No template service provided");
    }

    const html = await this.templateService.compile(params.name, params.params);
    return {
      html,
    };
  }

  /**
   * Sends an email using pre-rendered content
   */
  abstract sendEmail(params: SendRenderedEmailParams): Promise<MailingResponse>;

  /**
   * Sends multiple emails using pre-rendered content
   */
  abstract sendEmailMultiple(
    params: SendRenderedEmailMultipleParams,
  ): Promise<MailingResponse>;
}
