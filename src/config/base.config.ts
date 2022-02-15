import Joi = require('joi');
import registerWithValidation from './core/register-with-validation.util';

export default registerWithValidation(
  'base',
  () => ({
    nodeEnv: process.env.NODE_ENV || 'DEV',
    port: process.env.PORT || 5000,
    selfUrl: process.env.SELF_URL || 'http://localhost:5000',
  }),
  {
    NODE_ENV: Joi.string().allow('DEV', 'TEST', 'PROD'),
    PORT: Joi.number().integer().min(1024).max(65535),
    SELF_URL: Joi.string(),
  },
);
