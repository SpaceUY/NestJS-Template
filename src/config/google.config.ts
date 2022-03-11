import Joi = require('joi');
import registerWithValidation from './core/register-with-validation.util';

export default registerWithValidation(
  'google',
  () => ({
    oauth: {
      enabled: process.env.GOOGLE_OAUTH_ENABLED == 'true',
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
      secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
      audience: process.env.GOOGLE_OAUTH_AUDIENCE || '',
      callbackURL:
        process.env.GOOGLE_OAUTH_CALLBACK_URL ||
        `${
          process.env.SELF_URL || 'http://localhost:5000'
        }/auth/google/callback`,
    },
  }),
  {
    GOOGLE_OAUTH_ENABLED: Joi.boolean().default(false),
    GOOGLE_OAUTH_CLIENT_ID: Joi.string().when('GOOGLE_OAUTH_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    GOOGLE_OAUTH_CLIENT_SECRET: Joi.string().when('GOOGLE_OAUTH_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    GOOGLE_OAUTH_AUDIENCE: Joi.string().when('GOOGLE_OAUTH_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    GOOGLE_OAUTH_CALLBACK_URL: Joi.string().optional(),
  },
);
