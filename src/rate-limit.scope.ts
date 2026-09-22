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
  enabled: boolean;
};

/**
 * The window and the per-client allowance the global throttler applies.
 *
 * The defaults — 100 requests a minute per client — are deliberately a
 * ceiling on abuse rather than a quota: a browser session or a polling
 * dashboard stays well under them, while credential stuffing against the
 * public auth routes does not.
 *
 * Neither `ttlMs` nor `limit` may be absent and neither may be zero. A `0`
 * limit would lock the API out entirely and a `0` window would disable the
 * guard while leaving it registered, which is the kind of silent off switch
 * this scope refuses to allow through those two knobs.
 *
 * `enabled` is the explicit, non-silent way to turn the guard off — for a
 * deployment where something in front of the app already rate-limits (an API
 * gateway, a WAF) or where per-instance in-memory counting
 * (`ThrottlerModule.forRootAsync` in `src/app.module.ts`) is known to be
 * wrong for the topology, e.g. several instances behind a load balancer with
 * no shared counter store. Defaulting to `true` means an environment that
 * never sets `RATE_LIMIT_ENABLED` keeps the guard on.
 */
const validate = (raw: Record<string, unknown>): RateLimitScopeConfig => {
  const schema = Joi.object<RateLimitScopeConfig>({
    ttlMs: Joi.number().integer().min(1000).default(60_000),
    limit: Joi.number().integer().min(1).default(100),
    enabled: Joi.boolean().default(true),
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
    enabled: from.env('RATE_LIMIT_ENABLED'),
  },
  validate,
);
