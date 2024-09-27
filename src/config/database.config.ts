import Joi = require('joi');
import registerWithValidation from './core/register-with-validation.util';

export default registerWithValidation(
  'database',
  () => ({
    url: process.env.DATABASE_URL,
  }),
  {
    DATABASE_URL: Joi.string().required(),
  },
);
