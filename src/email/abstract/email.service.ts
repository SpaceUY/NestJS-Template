import {
  MailingResponse,
  SendRenderedEmailParams,
  SendRenderedEmailMultipleParams,
} from './email.interface';

export abstract class EmailService {
  constructor() {}

  /**
   * Sends an email using pre-rendered content
   */
  abstract sendEmail(params: SendRenderedEmailParams): Promise<MailingResponse>;

  /**
   * Sends multiple emails using pre-rendered content
   */
  abstract sendEmailBatch(
    params: SendRenderedEmailMultipleParams,
  ): Promise<MailingResponse>;
}
