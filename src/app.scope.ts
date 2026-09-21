import * as Joi from 'joi';
import { configSources as from } from './config-provider/abstract/config-source.util';
import { defineConfigScope } from './config-provider/abstract/define-config-scope.util';

export type AppScopeConfig = {
  nodeEnv: string;
  port: number;
  selfUrl: string;
  corsOrigins: string[];
  swaggerEnabled: boolean;
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

const validate = (raw: Record<string, unknown>): AppScopeConfig => {
  const schema = Joi.object<AppScopeConfig>({
    nodeEnv: Joi.string().valid('DEV', 'TEST', 'PROD').default('DEV'),
    port: Joi.number().integer().min(1024).max(65535).default(5000),
    selfUrl: Joi.string().default('http://localhost:5000'),
    corsOrigins: Joi.when('nodeEnv', {
      is: 'PROD',
      then: originList.required(),
      otherwise: originList.default(['*']),
    }),
    // Swagger publishes the whole API surface, so production must not serve
    // it. That could have been a bare `nodeEnv !== 'PROD'` check in
    // `src/main.ts` with no new key, and the flag is deliberately preferred to
    // it: `nodeEnv` already drives the CORS rule above, so the only way to get
    // docs on a prod-like environment without this flag is to lie about
    // `NODE_ENV`, which silently re-allows a wildcard `CORS_ORIGINS`. One knob
    // per decision. The default keeps the safe behaviour — off in PROD, on
    // everywhere else — so an environment that never sets `SWAGGER_ENABLED`
    // behaves exactly as the `nodeEnv` check would have.
    swaggerEnabled: Joi.when('nodeEnv', {
      is: 'PROD',
      then: Joi.boolean().default(false),
      otherwise: Joi.boolean().default(true),
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
    swaggerEnabled: from.env('SWAGGER_ENABLED'),
  },
  validate,
);
