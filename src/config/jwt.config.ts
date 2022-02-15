import Joi = require('joi');
import registerWithValidation from './core/register-with-validation.util';

export default registerWithValidation(
  'jwt',
  () => ({
    secret: process.env.JWT_SECRET || 'Not A Safe Secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    ignoreExpiration: process.env.JWT_IGNORE_EXPIRATION === 'true',
  }),
  {
    JWT_SECRET: Joi.string(),
    JWT_EXPIRES_IN: Joi.string(),
    JWT_IGNORE_EXPIRATION: Joi.string().valid('true', 'false'),
  },
);
