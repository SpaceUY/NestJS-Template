import * as Joi from 'joi';
import { configSources as from } from './config-provider/abstract/config-source.util';
import { defineConfigScope } from './config-provider/abstract/define-config-scope.util';

export type AppScopeConfig = {
  nodeEnv: string;
  port: number;
  selfUrl: string;
  corsOrigins: string[];
};

// `CORS_ORIGINS` is a comma-separated list. Parsing lives here so the rule and
// the value stay in one place; `src/main.ts` only hands the result to
// `enableCors`.
const originList = Joi.string().custom((value: string, helpers) => {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) return helpers.error('any.invalid');

  // A wildcard is fine locally and never in production (finding `C3`).
  const nodeEnv = helpers.state.ancestors[0]?.nodeEnv;
  if (nodeEnv === 'PROD' && origins.includes('*')) {
    return helpers.error('any.invalid');
  }

  return origins;
});

const validate = (raw) => {
  const schema = Joi.object<AppScopeConfig>({
    nodeEnv: Joi.string().valid('DEV', 'TEST', 'PROD').default('DEV'),
    port: Joi.number().integer().min(1024).max(65535).default(5000),
    selfUrl: Joi.string().default('http://localhost:5000'),
    corsOrigins: Joi.when('nodeEnv', {
      is: 'PROD',
      then: originList.required(),
      otherwise: originList.default(['*']),
    }),
  });

  const { error, value } = schema.validate(raw, { abortEarly: false });
  if (error) throw new Error(error.message);
  return value;
};

export const appScope = defineConfigScope<AppScopeConfig>(
  'app',
  {
    nodeEnv: from.env('NODE_ENV'),
    port: from.env('PORT'),
    selfUrl: from.env('SELF_URL'),
    corsOrigins: from.env('CORS_ORIGINS'),
  },
  validate,
);
