import { InjectionToken, ModuleMetadata } from '@nestjs/common';
import { QueueProducerService } from './queue-producer.service';

/**
 * Broker-agnostic, per-message delivery options. Only fields with a genuine
 * per-message meaning across brokers live here; richer broker-specific options
 * (retries/backoff, cron, exchanges) stay in adapter-level extensions. Adapters
 * must honor a requested option natively or throw `UNSUPPORTED_OPTION` — they
 * never silently drop one (see `assertSupportedDeliveryOptions`).
 */
export interface QueueDeliveryOptions {
  // Delay before the message becomes available to consumers, in milliseconds.
  delay?: number;
  // Relative priority where supported (higher = delivered sooner).
  priority?: number;
}

/**
 * Broker-agnostic message envelope. Only fields universally supported across
 * brokers live here — broker-specific concerns (routing keys, exchanges,
 * partition keys) are handled by adapter-level extensions.
 */
export interface QueueEnvelope {
  queue: string;
  payload: unknown;
  headers?: Record<string, string>;
  options?: QueueDeliveryOptions;
}

export interface QueueProducerModuleOptions {
  // forRoot instantiates the adapter directly (no NestJS DI). Adapters that
  // need constructor arguments must use forRootAsync instead. No `imports` here
  // by design: the sync path uses no DI factory, so there is nothing to import —
  // use forRootAsync to bring in a non-global module (e.g. a custom logger).
  adapter: new () => QueueProducerService;
  isGlobal?: boolean;
}

// `TArgs` is the tuple of values the `inject` tokens resolve to. It is inferred
// from the factory at the call site, which is what keeps a typed factory —
// `(config: SomeScopeConfig) => ...` — assignable here. A plain `unknown[]`
// would reject it: function parameters are contravariant.
export interface QueueProducerModuleAsyncOptions<
  TArgs extends unknown[] = unknown[],
> {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (
    ...args: TArgs
  ) => Promise<QueueProducerService> | QueueProducerService;
  isGlobal?: boolean;
}
