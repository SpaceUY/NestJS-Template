import Joi = require('joi');
import registerWithValidation from './core/register-with-validation.util';

export default registerWithValidation(
  'expo',
  () => ({
    accessToken: process.env.EXPO_ACCESS_TOKEN || '',
  }),
  {
    EXPO_ACCESS_TOKEN: Joi.string(),
  },
);
