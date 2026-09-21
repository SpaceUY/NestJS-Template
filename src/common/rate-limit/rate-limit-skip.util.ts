import { ExecutionContext } from '@nestjs/common';

/**
 * Route prefixes the global rate limiter must never count.
 *
 * `/health` and `/health/live` are polled by a load balancer every 30
 * seconds, from a small set of source addresses that the throttler sees as
 * one client. Counting those probes means the balancer eventually reads a
 * `429`, marks healthy instances unhealthy and pulls them out of rotation —
 * the rate limiter would cause the outage it exists to prevent. A probe also
 * carries no work worth protecting: it is the cheapest route in the
 * application.
 *
 * `@SkipThrottle()` on the controller is the idiomatic way to say this, and
 * it is not used here because the health endpoints live in a file this change
 * does not own. The two are equivalent to the guard; if the decorator is
 * added later, drop the matching prefix from this list rather than keeping
 * both.
 */
export const UNTHROTTLED_PATH_PREFIXES = ['/health'] as const;

/**
 * Whether the throttler should let a request through uncounted.
 *
 * Matches on the exact prefix or a segment below it, so `/health` and
 * `/health/live` are skipped while a route that merely starts with the same
 * letters — `/healthcheck-admin` — is not.
 *
 * Non-HTTP execution contexts (a queue consumer, an RPC handler) have no path
 * to match and are not skipped: they never reach the HTTP guard in the first
 * place, and answering `true` here would be a blanket exemption nobody asked
 * for.
 *
 * @param context The execution context the guard is deciding about.
 * @returns True when the request must not be rate limited.
 */
export const skipUnthrottledPath = (context: ExecutionContext): boolean => {
  if (context.getType() !== 'http') return false;

  const request = context
    .switchToHttp()
    .getRequest<{ path?: string; url?: string }>();
  const path = (request.path ?? request.url ?? '').split('?')[0];

  return UNTHROTTLED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
};
