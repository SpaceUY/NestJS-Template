import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Channel, ChannelModel, ConsumeMessage, connect } from 'amqplib';
import { QueueConsumerAdapter } from '../abstract/consumer/queue-consumer.adapter';
import { MessageContext } from '../abstract/consumer/queue-consumer.interfaces';
import {
  QueueConsumerError,
  QUEUE_CONSUMER_ERRORS,
} from '../abstract/consumer/queue-consumer.error';
import { RabbitMqConsumerAdapterOptions } from './rabbitmq-adapter.interfaces';
import { RabbitMqMessageContext } from './rabbitmq-message.context';

type ConsumerCallback = (
  payload: unknown,
  ctx: MessageContext,
) => Promise<void>;

interface ActiveConsumer {
  channel: Channel;
  consumerTag: string;
}

@Injectable()
export class RabbitMqConsumerAdapter
  extends QueueConsumerAdapter
  implements OnModuleDestroy
{
  private connectionPromise: Promise<ChannelModel> | null = null;
  private readonly consumers = new Map<string, ActiveConsumer>();

  /**
   * Creates the adapter with the connection URL and topology/QoS options.
   *
   * @param {RabbitMqConsumerAdapterOptions} options - RabbitMQ connection URL plus optional topology and prefetch settings.
   */
  constructor(private readonly options: RabbitMqConsumerAdapterOptions) {
    super();
  }

  /**
   * Begins consuming a queue, invoking the callback for each delivered message.
   *
   * Opens a dedicated channel per queue, optionally asserts the queue and sets
   * prefetch, then registers the consumer. Duplicate starts for the same queue
   * are ignored.
   *
   * @param {string} queue - Name of the queue to consume.
   * @param {ConsumerCallback} callback - Handler invoked with the parsed payload and message context.
   * @returns {Promise<void>} Resolves once the consumer is registered.
   * @throws {QueueConsumerError} With code `CONSUME_FAILED` if the channel or
   * consumer cannot be established.
   */
  async startConsuming(
    queue: string,
    callback: ConsumerCallback,
  ): Promise<void> {
    if (this.consumers.has(queue)) {
      this.logger.warn({
        message: 'Already consuming queue; ignoring duplicate start',
        data: { queue },
      });
      return;
    }

    let channel: Channel;
    try {
      const connection = await this._getConnection();
      // One channel per queue isolates prefetch/QoS and channel failures.
      channel = await connection.createChannel();
    } catch (error) {
      throw this._consumeError(queue, error);
    }

    try {
      if (this.options.assertTopology !== false) {
        await channel.assertQueue(queue, { durable: true });
      }
      if (this.options.prefetch !== undefined) {
        await channel.prefetch(this.options.prefetch);
      }

      const { consumerTag } = await channel.consume(queue, async (message) => {
        // A null delivery means the broker cancelled the consumer.
        if (!message) return;
        await this._handleMessage(channel, message, callback);
      });

      this.consumers.set(queue, { channel, consumerTag });
    } catch (error) {
      await channel.close().catch(() => undefined);
      throw this._consumeError(queue, error);
    }

    this.logger.log({
      message: 'Started consuming RabbitMQ queue',
      data: { queue },
    });
  }

  /**
   * Stops the consumer for a queue and closes its channel.
   *
   * No-op if the queue is not being consumed. Cleanup failures are logged but
   * not thrown, since the consumer registration is already removed.
   *
   * @param {string} queue - Name of the queue to stop consuming.
   * @returns {Promise<void>} Resolves once the consumer has been cancelled and its channel closed.
   */
  async stopConsuming(queue: string): Promise<void> {
    const active = this.consumers.get(queue);
    if (!active) return;

    this.consumers.delete(queue);
    try {
      await active.channel.cancel(active.consumerTag);
      await active.channel.close();
    } catch (error) {
      this.logger.error({
        message: 'Failed to stop RabbitMQ consumer cleanly',
        data: { queue },
        error,
      });
    }

    this.logger.log({
      message: 'Stopped consuming RabbitMQ queue',
      data: { queue },
    });
  }

  /**
   * Closes the shared connection (and any open consumer channels) on module
   * teardown.
   *
   * `QueueConsumerModule` already cancels each consumer via `stopConsuming`;
   * this closes the underlying connection those channels share, which would
   * otherwise leak. No-op when nothing was ever connected. The connection's
   * `close` handler clears the cached state.
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
        message: 'Failed to close RabbitMQ consumer connection',
        error,
      });
    }
  }

  /**
   * Runs the handler for a single message and applies the implicit ack/nack
   * contract: ack on success, nack on throw, unless the handler settled the
   * message explicitly via the context.
   *
   * Settle failures are logged and swallowed so a single bad message cannot
   * tear down the consumer.
   *
   * @param {Channel} channel - Channel the message was delivered on.
   * @param {ConsumeMessage} message - The raw RabbitMQ delivery.
   * @param {ConsumerCallback} callback - Handler invoked with the parsed payload and message context.
   * @returns {Promise<void>} Resolves once the message has been handled and settled (or settling failed and was logged).
   */
  private async _handleMessage(
    channel: Channel,
    message: ConsumeMessage,
    callback: ConsumerCallback,
  ): Promise<void> {
    const ctx = new RabbitMqMessageContext(channel, message);
    const payload = this._parseBody(message.content);

    let handlerError: unknown;
    try {
      await callback(payload, ctx);
    } catch (error) {
      handlerError = error;
      this.logger.error({
        message: 'Queue handler threw while processing RabbitMQ message',
        data: { messageId: message.properties.messageId },
        error,
      });
    }

    if (ctx.wasAcknowledged) return;

    try {
      if (handlerError) {
        await ctx.nack();
      } else {
        await ctx.ack();
      }
    } catch (settleError) {
      // ctx surfaces ACK_FAILED / NACK_FAILED; log and keep the consumer alive.
      const code =
        settleError instanceof QueueConsumerError
          ? settleError.code
          : QUEUE_CONSUMER_ERRORS.CONSUME_FAILED;
      this.logger.error({
        message: 'Failed to settle RabbitMQ message',
        data: { messageId: message.properties.messageId, code },
        error: settleError,
      });
    }
  }

  /**
   * Parses message content as JSON, falling back to the raw string.
   *
   * @param {Buffer} content - Raw message body buffer.
   * @returns {unknown} The parsed JSON value, or the decoded string if it is not valid JSON.
   */
  private _parseBody(content: Buffer): unknown {
    const text = content.toString();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /**
   * Returns the shared connection, lazily establishing it on first use.
   *
   * Caches the connection promise so concurrent callers share one connection,
   * and clears the cache (along with active consumers) on close so the next
   * start reconnects lazily.
   *
   * @returns {Promise<ChannelModel>} Resolves with the established channel model.
   * @throws Propagates the underlying `connect` error if the connection cannot be established.
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
          // Fail-fast: drop the cached connection on close so the next start
          // reconnects lazily. In-flight consumers are not auto-restored.
          connection.on('close', () => {
            this.connectionPromise = null;
            this.consumers.clear();
          });
          return connection;
        })
        .catch((error) => {
          this.connectionPromise = null;
          throw error;
        });
    }
    return this.connectionPromise;
  }

  /**
   * Logs the failure and builds a wrapped consumer error for a queue.
   *
   * @param {string} queue - Queue whose consumer failed to start.
   * @param {unknown} error - Underlying cause.
   * @returns {QueueConsumerError} A `QueueConsumerError` with code `CONSUME_FAILED` wrapping the cause.
   */
  private _consumeError(queue: string, error: unknown): QueueConsumerError {
    this.logger.error({
      message: 'Failed to start RabbitMQ consumer',
      data: { queue },
      error,
    });
    return new QueueConsumerError(
      QUEUE_CONSUMER_ERRORS.CONSUME_FAILED,
      `Failed to consume queue "${queue}"`,
      { queue, cause: (error as Error).message },
    );
  }
}
