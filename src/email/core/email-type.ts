import { ClientResponse } from '@sendgrid/mail';
import { EmailRegistration } from './register-email';
import { SenderOptions } from './sender-options';

export interface EmailType<TReg extends EmailRegistration> {
  send: (
    to: string,
    locals: TReg extends EmailRegistration<infer U> ? U : never,
    options?: SenderOptions,
  ) => Promise<ClientResponse>;
}
