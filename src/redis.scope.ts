import * as Joi from 'joi';
import { configSources as from } from './config-provider/abstract/config-source.util';
import { defineConfigScope } from './config-provider/abstract/define-config-scope.util';

// Shared by every module that talks to the same Redis instance
// (src/cache/redis-adapter/, src/queues/bullmq-adapter/) — it is
// application-level config, not owned by either module, the same way
// src/app.scope.ts is.
export type RedisScopeConfig = {
  host: string;
  port: number;
  password: string;
};

const schema = Joi.object<RedisScopeConfig>({
  host: Joi.string().default('localhost'),
  port: Joi.number().integer().default(6379),
  password: Joi.string().optional().allow('').default(''),
});

export const redisScope = defineConfigScope<RedisScopeConfig>(
  'redis',
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
