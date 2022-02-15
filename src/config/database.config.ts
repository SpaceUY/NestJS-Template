import Joi = require('joi');
import { ConnectionOptions } from 'typeorm';
import registerWithValidation from './core/register-with-validation.util';

export default registerWithValidation(
  'database',
  () => ({
    type: (process.env.DB_TYPE || 'postgres') as ConnectionOptions['type'],
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  }),
  {
    DB_TYPE: Joi.string(),
    DB_HOST: Joi.string().required(),
    DB_PORT: Joi.number().integer().min(1024).max(65535),
    DB_USERNAME: Joi.string().required(),
    DB_PASSWORD: Joi.string().required(),
    DB_DATABASE: Joi.string().required(),
  },
);
