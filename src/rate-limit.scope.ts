import * as Joi from 'joi';
import { configSources as from } from './config-provider/abstract/config-source.util';
import { defineConfigScope } from './config-provider/abstract/define-config-scope.util';

// Application-level, like src/app.scope.ts and src/redis.scope.ts, rather
// than sitting next to src/common/rate-limit/: a scope imports
// src/config-provider/, which already imports src/common/observability/logger/,
// so a scope under src/common/ closes an import cycle between the two
// platform modules — `pnpm run modularity:check` rejects it. The limits are
// the application's policy in any case; the module under src/common/ only
// binds the guard.

export type RateLimitScopeConfig = {
  ttlMs: number;
  limit: number;
};

/**
 * The window and the per-client allowance the global throttler applies.
 *
 * The defaults — 100 requests a minute per client — are deliberately a
 * ceiling on abuse rather than a quota: a browser session or a polling
 * dashboard stays well under them, while credential stuffing against the
 * public auth routes does not.
 *
 * Neither value may be absent and neither may be zero. A `0` limit would lock
 * the API out entirely and a `0` window would disable the guard while leaving
 * it registered, which is the kind of silent off switch this scope exists to
 * prevent.
 */
const validate = (raw: Record<string, unknown>): RateLimitScopeConfig => {
  const schema = Joi.object<RateLimitScopeConfig>({
    ttlMs: Joi.number().integer().min(1000).default(60_000),
    limit: Joi.number().integer().min(1).default(100),
  });

  const { error, value } = schema.validate(raw, { abortEarly: false });
  if (error) throw new Error(error.message);
  return value;
};

export const rateLimitScope = defineConfigScope<RateLimitScopeConfig>(
  'rateLimit',
  {
    ttlMs: from.env('RATE_LIMIT_TTL_MS'),
    limit: from.env('RATE_LIMIT_LIMIT'),
  },
  validate,
);
