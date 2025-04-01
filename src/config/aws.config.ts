import Joi = require('joi');
import registerWithValidation from './core/register-with-validation.util';

export default registerWithValidation(
  'aws',
  () => ({
    s3: {
      bucket: process.env.AWS_S3_BUCKET_NAME || '',
      expiresInSeconds: 3600,
    },
    base: {
      region: process.env.AWS_REGION || '',
      accessKeyId: process.env.AWS_ACCESS_KEY || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  }),
  {
    AWS_S3_BUCKET_NAME: Joi.string(),
    AWS_REGION: Joi.string(),
    AWS_ACCESS_KEY: Joi.string().optional(),
    AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
  },
);
