import Joi = require('joi');
import { configSources as from } from '../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../config-provider/abstract/define-config-scope.util';

export const EMAIL_ADAPTERS = {
  AWS_SES: 'AWS_SES',
  SENDGRID: 'SENDGRID',
  RESEND: 'RESEND',
  CONSOLE: 'CONSOLE',
} as const;

export type EmailScopeConfig = {
  adapter: string;
  from: string;
  sendgridApiKey: string;
  resendApiKey: string;
  resendEmailFrom: string;
  sesRegion: string;
  sesAccessKeyId: string;
  sesSecretAccessKey: string;
};

const schema = Joi.object<EmailScopeConfig>({
  adapter: Joi.string()
    .valid(...Object.values(EMAIL_ADAPTERS))
    .default(EMAIL_ADAPTERS.CONSOLE),
  from: Joi.string().email().optional().default('fake@example.com'),
  sendgridApiKey: Joi.string().optional().default(''),
  resendApiKey: Joi.string().optional().default(''),
  resendEmailFrom: Joi.string().email().optional().default(''),
  sesRegion: Joi.string().optional().default(''),
  sesAccessKeyId: Joi.string().optional().default(''),
  sesSecretAccessKey: Joi.string().optional().default(''),
});

export const emailScope = defineConfigScope<EmailScopeConfig>(
  'email',
  {
    adapter: from.env('EMAIL_ADAPTER'),
    from: from.env('EMAIL_FROM'),
    sendgridApiKey: from.env('SENDGRID_API_KEY'),
    resendApiKey: from.env('RESEND_API_KEY'),
    resendEmailFrom: from.env('RESEND_EMAIL_FROM'),
    sesRegion: from.env('AWS_SES_REGION'),
    sesAccessKeyId: from.env('AWS_ACCESS_KEY'),
    sesSecretAccessKey: from.env('AWS_SECRET_ACCESS_KEY'),
  },
  (raw) => {
    const { error, value } = schema.validate(raw, { abortEarly: false });
    if (error) throw new Error(error.message);
    return value;
  },
);
