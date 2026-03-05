import Joi = require('joi');
import registerWithValidation from './core/register-with-validation.util';

export const EMAIL_ADAPTERS = {
  AWS_SES: 'AWS_SES',
  SENDGRID: 'SENDGRID',
  RESEND: 'RESEND',
  CONSOLE: 'CONSOLE',
} as const;

export default registerWithValidation(
  'email',
  () => ({
    adapter: process.env.EMAIL_ADAPTER || EMAIL_ADAPTERS.CONSOLE,
    from:
      process.env.RESEND_EMAIL_FROM ||
      process.env.EMAIL_FROM ||
      'fake@example.com',
    sendgrid: { apiKey: process.env.SENDGRID_API_KEY as string },
    resend: {
      apiKey: process.env.RESEND_API_KEY as string,
      emailFrom: process.env.RESEND_EMAIL_FROM as string,
    },
  }),
  {
    EMAIL_ADAPTER: Joi.string()
      .valid(...Object.values(EMAIL_ADAPTERS))
      .default(EMAIL_ADAPTERS.CONSOLE),
    EMAIL_FROM: Joi.string().email().optional(),
    SENDGRID_API_KEY: Joi.string().optional(),
    RESEND_API_KEY: Joi.string().optional(),
    RESEND_EMAIL_FROM: Joi.string().email().optional(),
  },
);
