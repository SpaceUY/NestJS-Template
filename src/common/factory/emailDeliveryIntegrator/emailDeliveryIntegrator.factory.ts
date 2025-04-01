import { SendgridEmailDeliveryIntegrator } from './sendgridEmailDeliveryIntegrator';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';
import { EmailType } from 'src/email/sendgrid/core/email-type';
import {
  EmailKeyHost,
  EmailRegistration,
} from 'src/email/sendgrid/core/register-email';
import { SenderOptions } from 'src/email/sendgrid/core/sender-options';

export interface IEmailDeliveryIntegrator {
  sendEmail(
    template: EmailType<EmailRegistration & EmailKeyHost>,
    emailRegistration: EmailRegistration,
    to: string,
    locals: Record<string, string>,
    options?: SenderOptions,
    subject?: string,
  ): Promise<void>;
}

export default class EmailDeliveryIntegratorFactory {
  static getEmailDeliveryIntegrator(
    emailDeliveryIntegratorName: string,
  ): IEmailDeliveryIntegrator {
    switch (emailDeliveryIntegratorName) {
      case EmailDeliveryIntegratorName.SENDGRID:
        return new SendgridEmailDeliveryIntegrator();
      default:
        throw new RequestException(
          Exceptions.generic.internalServer({
            msg: 'Unsupported email delivery integrator',
          }),
        );
    }
  }
}

export enum EmailDeliveryIntegratorName {
  SENDGRID = 'SENDGRID',
}
