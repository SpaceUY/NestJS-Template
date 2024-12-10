import { IEmailDeliveryIntegrator } from './emailDeliveryIntegrator.factory';
import { EmailType } from '../../../email/core/email-type';
import {
  EmailKeyHost,
  EmailRegistration,
} from '../../../email/core/register-email';
import { SenderOptions } from 'src/email/core/sender-options';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';
export class SendgridEmailDeliveryIntegrator
  implements IEmailDeliveryIntegrator
{
  async sendEmail(
    template: EmailType<EmailRegistration & EmailKeyHost>,
    emailRegistration: EmailRegistration,
    to: string,
    locals: Record<string, string>,
    options?: SenderOptions,
  ): Promise<void> {
    try {
      await template.send(to, locals, options);
    } catch (error) {
      throw new RequestException(
        Exceptions.generic.internalServer({ msg: error.message }),
      );
    }
  }
}
