import { SendgridEmailDeliveryIntegrator } from './sendgridEmailDeliveryIntegrator';
import { EmailType } from '../../../email/core/email-type';
import {
  EmailKeyHost,
  EmailRegistration,
} from '../../../email/core/register-email';
import { SenderOptions } from 'src/email/core/sender-options';

export interface IEmailDeliveryIntegrator {
  sendEmail(
    template: EmailType<EmailRegistration & EmailKeyHost>,
    emailRegistration: EmailRegistration,
    to: string,
    locals: any,
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
        return new SendgridEmailDeliveryIntegrator();
    }
  }
}

export enum EmailDeliveryIntegratorName {
  SENDGRID = 'SENDGRID',
}
