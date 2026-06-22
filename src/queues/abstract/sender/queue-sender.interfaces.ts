import { InjectionToken, ModuleMetadata } from '@nestjs/common';
import { QueueSenderService } from './queue-sender.service';

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

export interface QueueSenderModuleOptions {
  // forRoot instantiates the adapter directly (no NestJS DI). Adapters that
  // need constructor arguments must use forRootAsync instead. No `imports` here
  // by design: the sync path uses no DI factory, so there is nothing to import —
  // use forRootAsync to bring in a non-global module (e.g. a custom logger).
  adapter: new () => QueueSenderService;
  isGlobal?: boolean;
}

export interface QueueSenderModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  // `any[]` mirrors NestJS's own *ModuleAsyncOptions: the factory's args are the
  // resolved `inject` tokens, whose types this interface can't know. `unknown[]`
  // would reject typed factories like `(config: Config) => ...` under strict
  // mode (parameter contravariance), so the explicit-any exception stays.
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => Promise<QueueSenderService> | QueueSenderService;
  isGlobal?: boolean;
}
