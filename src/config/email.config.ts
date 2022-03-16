import Joi = require('joi');
import registerWithValidation from './core/register-with-validation.util';

export default registerWithValidation(
  'email',
  () => ({
    from: process.env.EMAIL_FROM || 'fake@example.com',
    sendgrid: { apiKey: process.env.SENDGRID_API_KEY as string },
  }),
  {
    EMAIL_FROM: Joi.string().email().optional(),
    SENDGRID_API_KEY: Joi.string().required(),
  },
);
