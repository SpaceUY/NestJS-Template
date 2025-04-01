import Joi = require('joi');
import registerWithValidation from './core/register-with-validation.util';

export default registerWithValidation(
  'jwt',
  () => ({
    secret: process.env.JWT_SECRET || 'Not A Safe Secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    ignoreExpiration: process.env.JWT_IGNORE_EXPIRATION === 'true',
    secretResetPassword: process.env.JWT_RESET_PASSWORD_SECRET,
    expiresInResetPassword: process.env.JWT_RESET_PASSWORD_EXPIRES_IN || '7d',
    secretRefreshToken: process.env.JWT_REFRESH_SECRET,
    expiresInRefreshToken: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN,
  }),
  {
    JWT_SECRET: Joi.string(),
    JWT_EXPIRES_IN: Joi.string(),
    JWT_IGNORE_EXPIRATION: Joi.string().valid('true', 'false'),
  },
);
