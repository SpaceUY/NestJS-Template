import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Buffer } from 'node:buffer';
import { Channel, ChannelModel, ConfirmChannel, connect } from 'amqplib';
import { QueueSenderService } from '../abstract/sender/queue-sender.service';
import { QueueEnvelope } from '../abstract/sender/queue-sender.interfaces';
import {
  QueueSenderError,
  QUEUE_SENDER_ERRORS,
} from '../abstract/sender/queue-sender.error';
import {
  PublishToExchangeParams,
  RABBITMQ_RESERVED_HEADERS,
  RabbitMqSenderAdapterOptions,
} from './rabbitmq-adapter.interfaces';
import { assertSupportedDeliveryOptions } from '../abstract/sender/queue-delivery-options.util';

@Injectable()
export class RabbitMqSenderAdapter
  extends QueueSenderService
  implements OnModuleDestroy
{
  private connectionPromise: Promise<ChannelModel> | null = null;
  private channelPromise: Promise<ConfirmChannel> | null = null;
  private readonly assertedQueues = new Set<string>();
  private readonly assertedExchanges = new Set<string>();

  /**
   * Creates the adapter with the connection URL and publish/topology options.
   *
   * @param {RabbitMqSenderAdapterOptions} options - RabbitMQ connection URL plus optional persistence and topology settings.
   */
  constructor(private readonly options: RabbitMqSenderAdapterOptions) {
    super();
  }

  /**
   * Sends a payload to a queue using default options.
   *
   * @param {string} queue - Destination queue name.
   * @param {unknown} payload - Message body; serialized to JSON.
   * @returns {Promise<void>} Resolves once the broker has acknowledged the message.
   * @throws {QueueSenderError} If the message cannot be published (see `dispatch`).
   */
  async send(queue: string, payload: unknown): Promise<void> {
    await this.dispatch({ queue, payload });
  }

  /**
   * Dispatches an envelope to a queue, or to a named exchange when reserved
   * routing headers are present.
   *
   * Reserved headers (`exchange`/`routingKey`) route through `publishToExchange`;
   * all other headers become AMQP message headers. Publishing uses a confirm
   * channel, so this resolves only after the broker acks the message and
   * rejects if it nacks.
   *
   * @param {QueueEnvelope} envelope - Queue name, payload, optional headers and delivery options.
   * @returns {Promise<void>} Resolves once the broker has acknowledged the message.
   * @throws {QueueSenderError} With code `SEND_FAILED` if the broker nacks or
   * publishing otherwise fails.
   */
  async dispatch(envelope: QueueEnvelope): Promise<void> {
    const { queue, payload, headers = {}, options } = envelope;

    // RabbitMQ supports priority (on priority queues); native per-message delay
    // requires a plugin, so it isn't honored here.
    assertSupportedDeliveryOptions(
      options,
      ['priority'],
      'RabbitMqSenderAdapter',
    );

    // Reserved headers route through a named exchange; everything else is
    // forwarded as AMQP message headers.
    const exchange = headers[RABBITMQ_RESERVED_HEADERS.EXCHANGE];
    const routingKey = headers[RABBITMQ_RESERVED_HEADERS.ROUTING_KEY];
    const messageHeaders = this._stripReservedHeaders(headers);

    if (exchange) {
      await this.publishToExchange({
        exchange,
        routingKey,
        payload,
        headers: messageHeaders,
        priority: options?.priority,
      });
      return;
    }

    const channel = await this._getChannel();
    await this._assertQueue(channel, queue);

    try {
      await this._publishWithConfirm((confirm) =>
        channel.sendToQueue(
          queue,
          this._encode(payload),
          {
            headers: messageHeaders,
            persistent: this.options.persistent ?? true,
            ...(options?.priority !== undefined
              ? { priority: options.priority }
              : {}),
          },
          confirm,
        ),
      );
    } catch (error) {
      throw this._sendError(QUEUE_SENDER_ERRORS.SEND_FAILED, queue, error);
    }

    this.logger.debug({ message: 'Message sent to RabbitMQ', data: { queue } });
  }

  /**
   * RabbitMQ-specific extension: publish to a named exchange with a routing key.
   * The abstract `send`/`dispatch` use the default exchange; inject this concrete
   * adapter to reach exchanges.
   *
   * Optionally asserts the exchange, then publishes over a confirm channel, so
   * it resolves only after the broker acks the message and rejects if it nacks.
   *
   * @param {PublishToExchangeParams} params - Exchange name, routing key, payload, headers, exchange type, and priority.
   * @returns {Promise<void>} Resolves once the broker has acknowledged the message.
   * @throws {QueueSenderError} With code `SEND_FAILED` if the broker nacks or
   * publishing otherwise fails.
   */
  async publishToExchange(params: PublishToExchangeParams): Promise<void> {
    const {
      exchange,
      routingKey = '',
      payload,
      headers = {},
      type = 'topic',
      priority,
    } = params;

    const channel = await this._getChannel();
    await this._assertExchange(channel, exchange, type);

    try {
      await this._publishWithConfirm((confirm) =>
        channel.publish(
          exchange,
          routingKey,
          this._encode(payload),
          {
            headers,
            persistent: this.options.persistent ?? true,
            ...(priority !== undefined ? { priority } : {}),
          },
          confirm,
        ),
      );
    } catch (error) {
      throw this._sendError(
        QUEUE_SENDER_ERRORS.SEND_FAILED,
        `${exchange}/${routingKey}`,
        error,
      );
    }

    this.logger.debug({
      message: 'Message published to RabbitMQ exchange',
      data: { exchange, routingKey },
    });
  }

  /**
   * Closes the shared connection (and its confirm channel) on module teardown.
   *
   * No-op when nothing was ever connected. The connection's `close` handler
   * clears the cached state via `_reset`.
   *
   * @returns {Promise<void>} Resolves once the connection has been closed.
   */
  async onModuleDestroy(): Promise<void> {
    const connectionPromise = this.connectionPromise;
    if (!connectionPromise) return;

    try {
      const connection = await connectionPromise;
      await connection.close();
    } catch (error) {
      this.logger.error({
        message: 'Failed to close RabbitMQ sender connection',
        error,
      });
    }
  }

  /**
   * Serializes a payload to a JSON buffer for transport.
   *
   * @param {unknown} payload - Message body to encode.
   * @returns {Buffer} A buffer containing the JSON-serialized payload.
   */
  private _encode(payload: unknown): Buffer {
    return Buffer.from(JSON.stringify(payload));
  }

  /**
   * Wraps a confirm-channel publish in a promise that settles only once the
   * broker acks (resolve) or nacks (reject) the message.
   *
   * A resolved publish means the broker actually accepted the message — not
   * just that it was written to the local socket buffer. A synchronous throw
   * from the publish call (e.g. a closed channel) rejects too.
   *
   * @param {(confirm: (err: unknown) => void) => boolean} publish - Callback that performs the publish, receiving the confirm
   * callback to pass to the channel; an error argument signals a nack.
   * @returns {Promise<void>} Resolves when the broker acks the message; rejects on nack or a synchronous publish error.
   */
  private _publishWithConfirm(
    publish: (confirm: (err: unknown) => void) => boolean,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      publish((err) => (err ? reject(err) : resolve()));
    });
  }

  /**
   * Removes RabbitMQ reserved routing headers, leaving only AMQP message headers.
   *
   * @param {Record<string, string>} headers - Full header map including any reserved routing keys.
   * @returns {Record<string, string>} A new map containing only the non-reserved headers.
   */
  private _stripReservedHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    const reserved: string[] = Object.values(RABBITMQ_RESERVED_HEADERS);
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (!reserved.includes(key)) result[key] = value;
    }
    return result;
  }

  /**
   * Asserts a durable queue once per queue, unless topology assertion is disabled.
   *
   * Tracks already-asserted queues so the broker is only hit once per queue name.
   *
   * @param {Channel} channel - Channel used to assert the queue.
   * @param {string} queue - Queue name to assert.
   * @returns {Promise<void>} Resolves once the queue is asserted (or immediately if skipped).
   */
  private async _assertQueue(channel: Channel, queue: string): Promise<void> {
    if (
      this.options.assertTopology === false ||
      this.assertedQueues.has(queue)
    ) {
      return;
    }
    await channel.assertQueue(queue, { durable: true });
    this.assertedQueues.add(queue);
  }

  /**
   * Asserts a durable exchange once per exchange, unless topology assertion is disabled.
   *
   * Tracks already-asserted exchanges so the broker is only hit once per exchange name.
   *
   * @param {Channel} channel - Channel used to assert the exchange.
   * @param {string} exchange - Exchange name to assert.
   * @param {string} type - Exchange type (e.g. `topic`, `direct`).
   * @returns {Promise<void>} Resolves once the exchange is asserted (or immediately if skipped).
   */
  private async _assertExchange(
    channel: Channel,
    exchange: string,
    type: string,
  ): Promise<void> {
    if (
      this.options.assertTopology === false ||
      this.assertedExchanges.has(exchange)
    ) {
      return;
    }
    await channel.assertExchange(exchange, type, { durable: true });
    this.assertedExchanges.add(exchange);
  }

  /**
   * Returns the shared confirm channel, lazily creating it on first use.
   *
   * Caches the channel promise so concurrent publishers share one confirm
   * channel; clears the cache on failure so the next call retries.
   *
   * @returns {Promise<ConfirmChannel>} Resolves with the established confirm channel.
   * @throws {QueueSenderError} With code `CONNECTION_FAILED` if the channel cannot be created.
   */
  private async _getChannel(): Promise<ConfirmChannel> {
    if (!this.channelPromise) {
      this.channelPromise = this._getConnection()
        .then(async (connection) => {
          const channel = await connection.createConfirmChannel();
          // A channel can fail independently of its connection (e.g. a
          // channel-level protocol error). Without an 'error' listener amqplib
          // would surface it as an uncaught exception; without dropping the
          // cached promise on 'close' the next publish would reuse a dead
          // channel forever. Mirror the connection's fail-fast reconnect: log
          // and clear so the next publish rebuilds the channel.
          channel.on('error', (error) =>
            this.logger.error({ message: 'RabbitMQ channel error', error }),
          );
          channel.on('close', () => {
            this.channelPromise = null;
          });
          return channel;
        })
        .catch((error) => {
          this.channelPromise = null;
          throw this._sendError(
            QUEUE_SENDER_ERRORS.CONNECTION_FAILED,
            'channel',
            error,
          );
        });
    }
    return this.channelPromise;
  }

  /**
   * Returns the shared connection, lazily establishing it on first use.
   *
   * Caches the connection promise so concurrent callers share one connection,
   * and resets all cached state on close so the next call reconnects lazily.
   *
   * @returns {Promise<ChannelModel>} Resolves with the established channel model.
   * @throws {QueueSenderError} With code `CONNECTION_FAILED` if the connection cannot be established.
   */
  private async _getConnection(): Promise<ChannelModel> {
    if (!this.connectionPromise) {
      this.connectionPromise = connect(this.options.url)
        .then((connection) => {
          connection.on('error', (error) =>
            this.logger.error({
              message: 'RabbitMQ connection error',
              error,
            }),
          );
          // Fail-fast: drop the cached connection on close so the next call
          // reconnects lazily. No active retry loop.
          connection.on('close', () => this._reset());
          return connection;
        })
        .catch((error) => {
          this.connectionPromise = null;
          throw this._sendError(
            QUEUE_SENDER_ERRORS.CONNECTION_FAILED,
            'connection',
            error,
          );
        });
    }
    return this.connectionPromise;
  }

  /**
   * Clears all cached connection, channel, and asserted-topology state.
   *
   * Invoked on connection close so the next publish rebuilds everything lazily.
   */
  private _reset(): void {
    this.connectionPromise = null;
    this.channelPromise = null;
    this.assertedQueues.clear();
    this.assertedExchanges.clear();
  }

  /**
   * Logs the failure and builds a wrapped sender error for a target.
   *
   * Already-wrapped `QueueSenderError`s pass through unchanged so the original
   * code and cause are preserved.
   *
   * @param {(typeof QUEUE_SENDER_ERRORS)[keyof typeof QUEUE_SENDER_ERRORS]} code - Sender error code to assign to newly wrapped errors.
   * @param {string} target - Queue or `exchange/routingKey` the failure relates to.
   * @param {unknown} error - Underlying cause.
   * @returns {QueueSenderError} The existing `QueueSenderError`, or a new one wrapping the cause.
   */
  private _sendError(
    code: (typeof QUEUE_SENDER_ERRORS)[keyof typeof QUEUE_SENDER_ERRORS],
    target: string,
    error: unknown,
  ): QueueSenderError {
    // Already-wrapped errors (e.g. connection failure surfaced through the
    // channel factory) pass through unchanged.
    if (error instanceof QueueSenderError) return error;

    this.logger.error({
      message: 'RabbitMQ send failed',
      data: { target, code },
      error,
    });
    return new QueueSenderError(code, `RabbitMQ send failed for "${target}"`, {
      target,
      cause: (error as Error).message,
    });
  }
}
