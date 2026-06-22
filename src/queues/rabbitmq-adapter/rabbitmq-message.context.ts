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
  readonly deliveryCount?: number;

  private _wasAcknowledged = false;

  /**
   * Builds the context from a delivered message, extracting id, headers, and
   * delivery count for handler use.
   *
   * @param {Channel} channel - Channel the message was delivered on, used to ack/nack.
   * @param {ConsumeMessage} message - The raw RabbitMQ delivery.
   */
  constructor(
    private readonly channel: Channel,
    private readonly message: ConsumeMessage,
  ) {
    this.messageId = message.properties.messageId;
    this.headers = RabbitMqMessageContext.extractHeaders(
      message.properties.headers,
    );
    this.deliveryCount = RabbitMqMessageContext.extractDeliveryCount(
      message.properties.headers,
    );
  }

  /** Whether the message has already been settled (acked or nacked). */
  get wasAcknowledged(): boolean {
    return this._wasAcknowledged;
  }

  /**
   * Acknowledges the message, marking it as settled.
   *
   * @returns {Promise<void>} Resolves once the ack has been issued.
   * @throws {QueueConsumerError} With code `ACK_FAILED` if the channel rejects the ack.
   */
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

  /**
   * Negatively acknowledges the message, marking it as settled.
   *
   * Requeues by default so the message can be redelivered; pass `requeue: false`
   * to drop or dead-letter it.
   *
   * @param {{ requeue?: boolean }} [opts] - Settlement options; `requeue` controls whether the broker requeues the message (default `true`).
   * @returns {Promise<void>} Resolves once the nack has been issued.
   * @throws {QueueConsumerError} With code `NACK_FAILED` if the channel rejects the nack.
   */
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

  /**
   * Normalizes AMQP message headers into a string-valued map.
   *
   * Skips null/undefined values and stringifies the rest for a uniform shape.
   *
   * @param {ConsumeMessage['properties']['headers']} headers - Raw AMQP message headers, if any.
   * @returns {Record<string, string>} A map of header names to string values.
   */
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

  /**
   * Derives the delivery (attempt) count from the `x-death` header.
   *
   * RabbitMQ only tracks redeliveries via the `x-death` header populated by a
   * dead-letter retry setup; without one the count is unknown.
   *
   * @param {ConsumeMessage['properties']['headers']} headers - Raw AMQP message headers, if any.
   * @returns {number | undefined} The current attempt number, or `undefined` when no `x-death` data is present.
   */
  private static extractDeliveryCount(
    headers: ConsumeMessage['properties']['headers'],
  ): number | undefined {
    const xDeath = headers?.['x-death'];
    if (Array.isArray(xDeath) && xDeath.length > 0) {
      const count = Number(xDeath[0]?.count);
      if (!Number.isNaN(count)) return count + 1;
    }
    return undefined;
  }
}
