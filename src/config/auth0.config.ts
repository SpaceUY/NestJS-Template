import * as Joi from 'joi';
import registerWithValidation from './core/register-with-validation.util';

export default registerWithValidation(
  'auth0',
  () => ({
    domain: process.env.AUTH0_DOMAIN || '',
    clientId: process.env.AUTH0_CLIENT_ID || '',
    clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
    audience: process.env.AUTH0_AUDIENCE || '',
    mobileClientId: process.env.AUTH0_MOBILE_CLIENT_ID || '',
    issuer: process.env.AUTH0_ISSUER || `https://${process.env.AUTH0_DOMAIN}/`,
    algorithm: process.env.AUTH0_ALGORITHM || 'RS256',
    callbackUrl:
      process.env.AUTH0_CALLBACK_URL || 'http://localhost:3000/callback',
    logoutUrl: process.env.AUTH0_LOGOUT_URL || 'http://localhost:3000',
    mobileCallbackUrl:
      process.env.AUTH0_MOBILE_CALLBACK_URL || 'com.nestjstemplate://callback',
    tokenExpiration: parseInt(
      process.env.AUTH0_TOKEN_EXPIRATION || '86400',
      10,
    ),
    refreshTokenRotation: process.env.AUTH0_REFRESH_TOKEN_ROTATION === 'true',
    debug: process.env.AUTH0_DEBUG === 'true',
    logLevel: process.env.AUTH0_LOG_LEVEL || 'info',
    // Management API (optional)
    managementClientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID || '',
    managementClientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET || '',
  }),
  {
    AUTH0_DOMAIN: Joi.string().required(),
    AUTH0_CLIENT_ID: Joi.string().required(),
    AUTH0_CLIENT_SECRET: Joi.string().required(),
    AUTH0_AUDIENCE: Joi.string().required(),
    AUTH0_MOBILE_CLIENT_ID: Joi.string().optional(),
    AUTH0_ISSUER: Joi.string().optional(),
    AUTH0_ALGORITHM: Joi.string().valid('RS256', 'HS256').optional(),
    AUTH0_CALLBACK_URL: Joi.string().uri().optional(),
    AUTH0_LOGOUT_URL: Joi.string().uri().optional(),
    AUTH0_MOBILE_CALLBACK_URL: Joi.string().optional(),
    AUTH0_TOKEN_EXPIRATION: Joi.number()
      .integer()
      .min(300)
      .max(86400)
      .optional(),
    AUTH0_REFRESH_TOKEN_ROTATION: Joi.string()
      .valid('true', 'false')
      .optional(),
    AUTH0_DEBUG: Joi.string().valid('true', 'false').optional(),
    AUTH0_LOG_LEVEL: Joi.string()
      .valid('error', 'warn', 'info', 'debug')
      .optional(),
    AUTH0_MANAGEMENT_CLIENT_ID: Joi.string().optional(),
    AUTH0_MANAGEMENT_CLIENT_SECRET: Joi.string().optional(),
  },
);
