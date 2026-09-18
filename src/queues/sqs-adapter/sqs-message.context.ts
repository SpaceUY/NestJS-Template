import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  Message,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { MessageContext } from '../abstract/consumer/queue-consumer.interfaces';
import {
  QueueConsumerError,
  QUEUE_CONSUMER_ERRORS,
} from '../abstract/consumer/queue-consumer.error';

/**
 * Concrete `MessageContext` for SQS. Tracks whether the message was already
 * acknowledged so the consumer adapter can apply the implicit ack/nack contract
 * without double-acting on a message the handler settled explicitly.
 */
export class SqsMessageContext implements MessageContext {
  readonly messageId?: string;
  readonly headers: Record<string, string>;
  readonly deliveryCount?: number;

  private _wasAcknowledged = false;

  /**
   * Captures the message id, headers, and delivery count for a received message.
   *
   * @param {SQSClient} client - SQS client used to ack/nack the message.
   * @param {string} queueUrl - Resolved URL of the queue the message came from.
   * @param {Message} message - Raw SQS message being wrapped.
   */
  constructor(
    private readonly client: SQSClient,
    private readonly queueUrl: string,
    private readonly message: Message,
  ) {
    this.messageId = message.MessageId;
    this.headers = SqsMessageContext.extractHeaders(message);
    // Requires MessageSystemAttributeNames: ['ApproximateReceiveCount'] on the
    // ReceiveMessage call; already a 1-based count of deliveries.
    const received = message.Attributes?.ApproximateReceiveCount;
    this.deliveryCount = received ? Number(received) : undefined;
  }

  /** Whether the message has already been acked or nacked. */
  get wasAcknowledged(): boolean {
    return this._wasAcknowledged;
  }

  /**
   * Acknowledges the message by deleting it from the queue, marking the context
   * as settled.
   *
   * @returns {Promise<void>} Resolves once the message has been deleted.
   * @throws {QueueConsumerError} With code `ACK_FAILED` if the delete call fails.
   */
  async ack(): Promise<void> {
    this._wasAcknowledged = true;
    try {
      await this.client.send(
        new DeleteMessageCommand({
          QueueUrl: this.queueUrl,
          ReceiptHandle: this.message.ReceiptHandle,
        }),
      );
    } catch (error) {
      throw new QueueConsumerError(
        QUEUE_CONSUMER_ERRORS.ACK_FAILED,
        `Failed to ack SQS message "${this.messageId}"`,
        { messageId: this.messageId, cause: (error as Error).message },
      );
    }
  }

  /**
   * SQS has no message-discard primitive. Requeue (the default) makes the
   * message immediately visible again by zeroing its visibility timeout;
   * `requeue: false` leaves it untouched so it reappears only after the queue's
   * visibility timeout lapses (and is routed to a DLQ if a redrive policy is
   * configured).
   *
   * @param {{ requeue?: boolean }} [opts] - Settlement options; `requeue` (default true) controls whether
   *   the message is made immediately visible again.
   * @returns {Promise<void>} Resolves once the message has been settled.
   * @throws {QueueConsumerError} With code `NACK_FAILED` if the visibility
   *   change fails.
   */
  async nack(opts?: { requeue?: boolean }): Promise<void> {
    this._wasAcknowledged = true;
    const requeue = opts?.requeue ?? true;
    if (!requeue) return;

    try {
      await this.client.send(
        new ChangeMessageVisibilityCommand({
          QueueUrl: this.queueUrl,
          ReceiptHandle: this.message.ReceiptHandle,
          VisibilityTimeout: 0,
        }),
      );
    } catch (error) {
      throw new QueueConsumerError(
        QUEUE_CONSUMER_ERRORS.NACK_FAILED,
        `Failed to nack SQS message "${this.messageId}"`,
        { messageId: this.messageId, cause: (error as Error).message },
      );
    }
  }

  /**
   * Extracts string-valued message attributes into a plain headers map,
   * skipping attributes without a string value.
   *
   * @param {Message} message - Raw SQS message to read attributes from.
   * @returns {Record<string, string>} The headers keyed by attribute name.
   */
  private static extractHeaders(message: Message): Record<string, string> {
    const attributes = message.MessageAttributes ?? {};
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(attributes)) {
      if (value.StringValue !== undefined) {
        headers[key] = value.StringValue;
      }
    }
    return headers;
  }
}
