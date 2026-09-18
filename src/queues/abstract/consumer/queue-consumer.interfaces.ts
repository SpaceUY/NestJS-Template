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
  // 1-based count of how many times this message has been delivered, where the
  // broker exposes it (SQS ApproximateReceiveCount, BullMQ attemptsMade + 1,
  // RabbitMQ via the x-death header). Undefined when the broker can't report it.
  readonly deliveryCount?: number;
  /**
   * Acknowledges the message, removing it from the queue.
   *
   * @returns {Promise<void>} Resolves once the broker has accepted the acknowledgment.
   */
  ack(): Promise<void>;
  /**
   * Negatively acknowledges the message.
   *
   * @param {{ requeue?: boolean }} [opts] - When `requeue` is true (the default),
   *   the message is made available for redelivery; when false, it is discarded
   *   (dead-lettered if the broker is configured for it). Exact semantics vary
   *   per broker.
   * @returns {Promise<void>} Resolves once the broker has accepted the negative acknowledgment.
   */
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
  // need constructor arguments must use forRootAsync instead. No `imports` here
  // by design: the sync path uses no DI factory, so there is nothing to import —
  // use forRootAsync to bring in a non-global module (e.g. a custom logger).
  adapter: new () => QueueConsumerAdapter;
  consumers: ConsumerRegistration[];
  isGlobal?: boolean;
}

export interface QueueConsumerModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  // `any[]` mirrors NestJS's own *ModuleAsyncOptions: the factory's args are the
  // resolved `inject` tokens, whose types this interface can't know. `unknown[]`
  // would reject typed factories like `(config: Config) => ...` under strict
  // mode (parameter contravariance), so the explicit-any exception stays.
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => Promise<QueueConsumerAdapter> | QueueConsumerAdapter;
  consumers: ConsumerRegistration[];
  isGlobal?: boolean;
}
