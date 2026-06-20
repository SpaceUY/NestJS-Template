/**
 * Shared connection options for the RabbitMQ adapters.
 */
export interface RabbitMqConnectionOptions {
  // AMQP connection string, e.g. amqp://user:pass@host:5672/vhost
  url: string;
  // When true (default), the adapter idempotently asserts the queues and
  // exchanges it directly uses (durable). When false, assume infra/migrations
  // declared all topology. Queue↔exchange *bindings* are always managed
  // externally — the adapter never binds.
  assertTopology?: boolean;
}

export type RabbitMqSenderAdapterOptions = RabbitMqConnectionOptions;

export interface RabbitMqConsumerAdapterOptions extends RabbitMqConnectionOptions {
  // Per-channel prefetch (QoS). Limits unacked messages in flight per queue.
  // Unset = no limit.
  prefetch?: number;
}

export type RabbitMqExchangeType = 'direct' | 'topic' | 'fanout' | 'headers';

/**
 * Parameters for the dedicated exchange-publish path. The abstract
 * `send`/`dispatch` publish to the default exchange (routing key = queue name);
 * `publishToExchange` is the RabbitMQ-specific extension for routing through a
 * named exchange.
 */
export interface PublishToExchangeParams {
  exchange: string;
  routingKey?: string;
  payload: unknown;
  headers?: Record<string, string>;
  // Exchange type used only when asserting (assertTopology on). Default 'topic'.
  type?: RabbitMqExchangeType;
  // Message priority; honored when the target queue was declared with
  // x-max-priority.
  priority?: number;
}

/**
 * Envelope header keys that route `dispatch` through a named exchange instead of
 * the default exchange. They are lifted out of `QueueEnvelope.headers` and never
 * forwarded as AMQP message headers. This mirrors the dedicated
 * `publishToExchange` method for callers that only have the abstract envelope.
 */
export const RABBITMQ_RESERVED_HEADERS = {
  EXCHANGE: 'x-exchange',
  ROUTING_KEY: 'x-routing-key',
} as const;
