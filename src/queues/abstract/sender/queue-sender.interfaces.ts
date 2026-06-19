import { InjectionToken, ModuleMetadata } from '@nestjs/common';
import { QueueSenderService } from './queue-sender.service';

/**
 * Broker-agnostic message envelope. Only fields universally supported across
 * brokers live here — broker-specific concerns (routing keys, exchanges,
 * partition keys, delays) are handled by adapter-level extensions.
 */
export interface QueueEnvelope {
  queue: string;
  payload: unknown;
  headers?: Record<string, string>;
}

export interface QueueSenderModuleOptions {
  // forRoot instantiates the adapter directly (no NestJS DI). Adapters that
  // need constructor arguments must use forRootAsync instead.
  adapter: new () => QueueSenderService;
  isGlobal?: boolean;
}

export interface QueueSenderModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (
    ...args: any[]
  ) => Promise<QueueSenderService> | QueueSenderService;
  isGlobal?: boolean;
}
