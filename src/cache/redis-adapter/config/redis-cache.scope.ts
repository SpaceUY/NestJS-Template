import * as Joi from 'joi';
import { configSources as from } from '../../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../../config-provider/abstract/define-config-scope.util';

export type RedisCacheScopeConfig = {
  host: string;
  port: number;
  password: string;
};

const schema = Joi.object<RedisCacheScopeConfig>({
  host: Joi.string().default('localhost'),
  port: Joi.number().integer().default(6379),
  password: Joi.string().optional().allow('').default(''),
});

export const redisCacheScope = defineConfigScope<RedisCacheScopeConfig>(
  'redisCache',
  {
    host: from.env('REDIS_HOST'),
    port: from.env('REDIS_PORT'),
    password: from.env('REDIS_PASSWORD'),
  },
  (raw) => {
    const { error, value } = schema.validate(raw, { abortEarly: false });
    if (error) throw new Error(error.message);
    return value;
  },
);
