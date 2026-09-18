import * as Joi from 'joi';
import { configSources as from } from '../../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../../config-provider/abstract/define-config-scope.util';

export type S3ScopeConfig = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
};

const schema = Joi.object<S3ScopeConfig>({
  bucket: Joi.string().optional().default(''),
  region: Joi.string().optional().default(''),
  accessKeyId: Joi.string().optional().default(''),
  secretAccessKey: Joi.string().optional().default(''),
  expiresInSeconds: Joi.number().integer().default(3600),
});

export const s3Scope = defineConfigScope<S3ScopeConfig>(
  's3',
  {
    bucket: from.env('AWS_S3_BUCKET_NAME'),
    region: from.env('AWS_REGION'),
    accessKeyId: from.env('AWS_ACCESS_KEY'),
    secretAccessKey: from.env('AWS_SECRET_ACCESS_KEY'),
    expiresInSeconds: from.env('AWS_S3_EXPIRES_IN_SECONDS'),
  },
  (raw) => {
    const { error, value } = schema.validate(raw, { abortEarly: false });
    if (error) throw new Error(error.message);
    return value;
  },
);
