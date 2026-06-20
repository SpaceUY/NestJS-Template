import { Channel, ConsumeMessage } from 'amqplib';
import { MessageContext } from '../abstract/consumer/queue-consumer.interfaces';
import {
  QueueConsumerError,
  QUEUE_CONSUMER_ERRORS,
} from '../abstract/consumer/queue-consumer.error';

/**
 * Concrete `MessageContext` for RabbitMQ. Tracks whether the message was already
 * settled so the consumer adapter can apply the implicit ack/nack contract
 * without double-acting on a message the handler settled explicitly.
 */
export class RabbitMqMessageContext implements MessageContext {
  readonly messageId?: string;
  readonly headers: Record<string, string>;

  private _wasAcknowledged = false;

  constructor(
    private readonly channel: Channel,
    private readonly message: ConsumeMessage,
  ) {
    this.messageId = message.properties.messageId;
    this.headers = RabbitMqMessageContext.extractHeaders(
      message.properties.headers,
    );
  }

  get wasAcknowledged(): boolean {
    return this._wasAcknowledged;
  }

  async ack(): Promise<void> {
    this._wasAcknowledged = true;
    try {
      this.channel.ack(this.message);
    } catch (error) {
      throw new QueueConsumerError(
        QUEUE_CONSUMER_ERRORS.ACK_FAILED,
        `Failed to ack RabbitMQ message "${this.messageId}"`,
        { messageId: this.messageId, cause: (error as Error).message },
      );
    }
  }

  async nack(opts?: { requeue?: boolean }): Promise<void> {
    this._wasAcknowledged = true;
    const requeue = opts?.requeue ?? true;
    try {
      this.channel.nack(this.message, false, requeue);
    } catch (error) {
      throw new QueueConsumerError(
        QUEUE_CONSUMER_ERRORS.NACK_FAILED,
        `Failed to nack RabbitMQ message "${this.messageId}"`,
        { messageId: this.messageId, cause: (error as Error).message },
      );
    }
  }

  private static extractHeaders(
    headers: ConsumeMessage['properties']['headers'],
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers ?? {})) {
      if (value !== undefined && value !== null) {
        result[key] = String(value);
      }
    }
    return result;
  }
}
