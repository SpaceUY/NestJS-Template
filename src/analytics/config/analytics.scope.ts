import Joi from 'joi';
import { configSources as from } from '../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../config-provider/abstract/define-config-scope.util';

export const ANALYTICS_ADAPTERS = {
  POSTHOG: 'POSTHOG',
  CONSOLE: 'CONSOLE',
} as const;

export type AnalyticsScopeConfig = {
  adapter: string;
  posthogApiKey: string;
  posthogHost: string;
};

const validate = (raw) => {
  const schema = Joi.object<AnalyticsScopeConfig>({
    adapter: Joi.string()
      .valid(...Object.values(ANALYTICS_ADAPTERS))
      .default(ANALYTICS_ADAPTERS.CONSOLE),
    posthogApiKey: Joi.string().when('adapter', {
      is: ANALYTICS_ADAPTERS.POSTHOG,
      then: Joi.string().min(1).required(),
      otherwise: Joi.string().allow('').optional().default(''),
    }),
    posthogHost: Joi.string()
      .allow('')
      .optional()
      .default('https://us.i.posthog.com'),
  });

  const { error, value } = schema.validate(raw, { abortEarly: false });
  if (error) throw new Error(error.message);
  return value;
};

export const analyticsScope = defineConfigScope<AnalyticsScopeConfig>(
  'analytics',
  {
    adapter: from.env('ANALYTICS_ADAPTER'),
    posthogApiKey: from.env('POSTHOG_API_KEY'),
    posthogHost: from.env('POSTHOG_HOST'),
  },
  validate,
);
