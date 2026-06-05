import Joi = require('joi');
import { configSources as from } from './config-provider/abstract/config-source.util';
import { defineConfigScope } from './config-provider/abstract/define-config-scope.util';

export type AppScopeConfig = {
  nodeEnv: string;
  port: number;
  selfUrl: string;
};

export const appScope = defineConfigScope<AppScopeConfig>(
  'app',
  {
    nodeEnv: from.env('NODE_ENV'),
    port: from.env('PORT'),
    selfUrl: from.env('SELF_URL'),
  },
  Joi.object<AppScopeConfig>({
    nodeEnv: Joi.string().valid('DEV', 'TEST', 'PROD').default('DEV'),
    port: Joi.number().integer().min(1024).max(65535).default(5000),
    selfUrl: Joi.string().default('http://localhost:5000'),
  }),
);
