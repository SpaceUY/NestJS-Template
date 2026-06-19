import { InjectionToken, ModuleMetadata, Type } from '@nestjs/common';
import { QueueConsumerAdapter } from './queue-consumer.adapter';
import { QueueConsumerHandler } from './queue-consumer.handler';

/**
 * Passed to every `handle()` call. Ignored for simple cases; used directly when
 * explicit acknowledgment control is needed.
 */
export interface MessageContext {
  readonly messageId?: string;
  readonly headers: Record<string, string>;
  ack(): Promise<void>;
  nack(opts?: { requeue?: boolean }): Promise<void>;
}

/**
 * Binds a queue to the handler class responsible for its messages.
 */
export interface ConsumerRegistration {
  queue: string;
  handler: Type<QueueConsumerHandler>;
}

export interface QueueConsumerModuleOptions {
  // forRoot instantiates the adapter directly (no NestJS DI). Adapters that
  // need constructor arguments must use forRootAsync instead.
  adapter: new () => QueueConsumerAdapter;
  consumers: ConsumerRegistration[];
  isGlobal?: boolean;
}

export interface QueueConsumerModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (
    ...args: any[]
  ) => Promise<QueueConsumerAdapter> | QueueConsumerAdapter;
  consumers: ConsumerRegistration[];
  isGlobal?: boolean;
}
