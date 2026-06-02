import Joi = require('joi');
import registerWithValidation from './core/register-with-validation.util';

export default registerWithValidation(
  'database',
  () => ({
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  }),
  {
    DATABASE_URL: Joi.string().optional(),
    DB_HOST: Joi.string().optional(),
    DB_PORT: Joi.number().integer().optional(),
    DB_USER: Joi.string().optional(),
    DB_PASS: Joi.string().optional(),
    DB_NAME: Joi.string().optional(),
  },
);
