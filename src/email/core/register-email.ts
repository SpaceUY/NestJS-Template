import {
  TemplateLocals,
  TemplateRegistration,
} from 'src/template/core/template-base';
import { SenderOptions } from './sender-options';

export const EMAIL_REFIX = 'EMAIL_';

interface EmailRegistrationPug<T extends TemplateLocals = TemplateLocals> {
  type: 'TEMPLATE';
  templateRegistration: TemplateRegistration<T>;
  defaultOptions?: SenderOptions;
}

interface EmailRegistrationDynamic {
  type: 'DYNAMIC';
  templateId: string;
  defaultOptions?: SenderOptions;
}

export type EmailRegistration<T extends TemplateLocals = TemplateLocals> =
  | EmailRegistrationPug<T>
  | EmailRegistrationDynamic;

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

export function registerDynamicEmail<T extends TemplateLocals>(
  emailName: string,
  templateId: string,
  defaultOptions?: SenderOptions,
): EmailRegistration<T> & EmailKeyHost {
  const emailRegistration: EmailRegistration<T> = {
    type: 'DYNAMIC',
    templateId: templateId,
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
