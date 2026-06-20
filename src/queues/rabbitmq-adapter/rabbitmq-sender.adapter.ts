import { Injectable } from '@nestjs/common';
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
export class RabbitMqSenderAdapter extends QueueSenderService {
  private connectionPromise: Promise<ChannelModel> | null = null;
  private channelPromise: Promise<ConfirmChannel> | null = null;
  private readonly assertedQueues = new Set<string>();
  private readonly assertedExchanges = new Set<string>();

  constructor(private readonly options: RabbitMqSenderAdapterOptions) {
    super();
  }

  async send(queue: string, payload: unknown): Promise<void> {
    await this.dispatch({ queue, payload });
  }

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
            persistent: true,
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
            persistent: true,
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

  private _encode(payload: unknown): Buffer {
    return Buffer.from(JSON.stringify(payload));
  }

  // Wraps a confirm-channel publish in a promise that settles only once the
  // broker acks (resolve) or nacks (reject) the message, so a resolved
  // dispatch means the broker actually accepted it — not just that it was
  // written to the local socket buffer. A synchronous throw from the publish
  // call (e.g. closed channel) rejects too.
  private _publishWithConfirm(
    publish: (confirm: (err: unknown) => void) => boolean,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      publish((err) => (err ? reject(err) : resolve()));
    });
  }

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

  private async _getChannel(): Promise<ConfirmChannel> {
    if (!this.channelPromise) {
      this.channelPromise = this._getConnection()
        .then((connection) => connection.createConfirmChannel())
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

  private _reset(): void {
    this.connectionPromise = null;
    this.channelPromise = null;
    this.assertedQueues.clear();
    this.assertedExchanges.clear();
  }

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
