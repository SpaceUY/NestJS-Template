import { compile } from '@fastify/proxy-addr';
import { AppScopeConfig } from './app.scope';

type TrustFn = (address: string, hop: number) => boolean;

export interface DeferredTrustProxy {
  /** Handed to `new NodeAdapter({ trustProxy })`, which fixes it at construction. */
  readonly trust: TrustFn;
  /** Switches `trust` to the configured `TRUST_PROXY` once the app can read it. */
  apply: (value: AppScopeConfig['trustProxy']) => void;
}

/**
 * `NodeAdapter` takes `trustProxy` when it is constructed, but the value comes
 * from the app scope, which only exists once `NestFactory.create()` has built
 * the container — and the adapter has to be passed to that very call. The
 * adapter therefore gets a function that trusts nothing until `apply()` runs,
 * which is before the first request is accepted.
 *
 * Reading `process.env` here instead would break the rule that configuration
 * flows through a scope.
 *
 * A number is a hop count, as it was under Express (`1` for a single ALB).
 * `NodeAdapter` itself treats a bare number as "trust no proxy", so the count
 * is honoured here rather than handed over.
 */
export function createDeferredTrustProxy(): DeferredTrustProxy {
  let current: TrustFn = () => false;

  return {
    trust: (address, hop) => current(address, hop),
    apply: (value) => {
      current = toTrustFn(value);
    },
  };
}

function toTrustFn(value: AppScopeConfig['trustProxy']): TrustFn {
  if (typeof value === 'boolean') return () => value;
  if (typeof value === 'number') return (_address, hop) => hop < value;

  return compile(value.split(',').map((entry) => entry.trim()));
}
