import { ClientResponse } from '@sendgrid/mail';
import {
  TemplateLocals,
  TemplateRegistration,
} from 'src/template/core/template-base';
import { SenderOptions } from './sender-options';

export const EMAIL_REFIX = 'EMAIL_';

export interface EmailRegistration<T extends TemplateLocals = TemplateLocals> {
  type: 'TEMPLATE';
  templateRegistration: TemplateRegistration<T>;
  defaultOptions?: SenderOptions;
}

export interface EmailKeyHost {
  KEY: string;
}

export function registerEmail<T extends TemplateLocals>(
  emailName: string,
  template: TemplateRegistration<T>,
  defaultOptions?: SenderOptions,
): EmailRegistration<T> & EmailKeyHost {
  const emailRegistration: EmailRegistration<T> = {
    type: 'TEMPLATE',
    templateRegistration: template,
    defaultOptions,
  };

  Object.defineProperty(emailRegistration, 'KEY', {
    configurable: false,
    enumerable: false,
    value: `${EMAIL_REFIX}${emailName}`,
    writable: false,
  });

  return emailRegistration as EmailRegistration<T> & EmailKeyHost;
}
