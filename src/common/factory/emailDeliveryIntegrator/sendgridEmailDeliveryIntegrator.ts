import { IEmailDeliveryIntegrator } from './emailDeliveryIntegrator.factory';
import { EmailType } from '../../../email/core/email-type';
import {
  EmailKeyHost,
  EmailRegistration,
} from '../../../email/core/register-email';
import { SenderOptions } from 'src/email/core/sender-options';
export class SendgridEmailDeliveryIntegrator
  implements IEmailDeliveryIntegrator
{
  async sendEmail(
    template: EmailType<EmailRegistration & EmailKeyHost>,
    emailRegistration: EmailRegistration,
    to: string,
    locals: any,
    options?: SenderOptions,
  ): Promise<void> {
    try {
      await template.send(to, locals, options);
    } catch (error: any) {
      throw new Error(error);
    }
  }
}
