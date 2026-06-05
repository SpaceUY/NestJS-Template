import Joi = require('joi');
import { configSources as from } from '../../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../../config-provider/abstract/define-config-scope.util';

export type S3ScopeConfig = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
};

export const s3Scope = defineConfigScope<S3ScopeConfig>(
  's3',
  {
    bucket: from.env('AWS_S3_BUCKET_NAME'),
    region: from.env('AWS_REGION'),
    accessKeyId: from.env('AWS_ACCESS_KEY'),
    secretAccessKey: from.env('AWS_SECRET_ACCESS_KEY'),
    expiresInSeconds: from.env('AWS_S3_EXPIRES_IN_SECONDS'),
  },
  Joi.object<S3ScopeConfig>({
    bucket: Joi.string().optional().default(''),
    region: Joi.string().optional().default(''),
    accessKeyId: Joi.string().optional().default(''),
    secretAccessKey: Joi.string().optional().default(''),
    expiresInSeconds: Joi.number().integer().default(3600),
  }),
);
