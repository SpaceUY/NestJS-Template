import { Injectable } from '@nestjs/common';
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
export class RabbitMqConsumerAdapter extends QueueConsumerAdapter {
  private connectionPromise: Promise<ChannelModel> | null = null;
  private readonly consumers = new Map<string, ActiveConsumer>();

  constructor(private readonly options: RabbitMqConsumerAdapterOptions) {
    super();
  }

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

  // Runs the handler for a single message and applies the implicit ack/nack
  // contract: ack on success, nack on throw, unless the handler settled the
  // message explicitly via the context.
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

  private _parseBody(content: Buffer): unknown {
    const text = content.toString();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
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
