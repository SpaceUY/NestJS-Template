import { ExecutionContext } from '@nestjs/common';
import {
  skipUnthrottledPath,
  UNTHROTTLED_PATH_PREFIXES,
} from './rate-limit-skip.util';

const httpContext = (request: {
  path?: string;
  url?: string;
}): ExecutionContext =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const rpcContext = (): ExecutionContext =>
  ({ getType: () => 'rpc' }) as unknown as ExecutionContext;

describe('skipUnthrottledPath', () => {
  it('skips the readiness probe the load balancer polls', () => {
    expect(skipUnthrottledPath(httpContext({ path: '/health' }))).toBe(true);
  });

  it('skips the liveness probe', () => {
    expect(skipUnthrottledPath(httpContext({ path: '/health/live' }))).toBe(
      true,
    );
  });

  it('ignores a query string when matching', () => {
    expect(
      skipUnthrottledPath(httpContext({ path: '/health', url: '/health?x=1' })),
    ).toBe(true);
  });

  it('falls back to the raw url when the adapter exposes no path', () => {
    expect(skipUnthrottledPath(httpContext({ url: '/health/live' }))).toBe(
      true,
    );
  });

  // Prefix matching stops at a segment boundary, so an admin route that
  // merely starts with the same letters stays limited.
  it('does not skip a route that only shares the prefix letters', () => {
    expect(
      skipUnthrottledPath(httpContext({ path: '/healthcheck-admin' })),
    ).toBe(false);
  });

  it('limits everything else', () => {
    for (const path of ['/', '/auth/google/web', '/auth/auth0/login']) {
      expect(skipUnthrottledPath(httpContext({ path }))).toBe(false);
    }
  });

  it('does not exempt a non-HTTP context', () => {
    expect(skipUnthrottledPath(rpcContext())).toBe(false);
  });

  it('survives a request with neither path nor url', () => {
    expect(skipUnthrottledPath(httpContext({}))).toBe(false);
  });

  // The list is the contract with src/health/health.controller.ts: both of
  // its routes live under this prefix.
  it('exempts the health prefix and nothing else', () => {
    expect(UNTHROTTLED_PATH_PREFIXES).toEqual(['/health']);
  });
});
