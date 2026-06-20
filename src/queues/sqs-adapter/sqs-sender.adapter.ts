import { Injectable } from '@nestjs/common';
import {
  MessageAttributeValue,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { QueueSenderService } from '../abstract/sender/queue-sender.service';
import { QueueEnvelope } from '../abstract/sender/queue-sender.interfaces';
import {
  QueueSenderError,
  QUEUE_SENDER_ERRORS,
} from '../abstract/sender/queue-sender.error';
import {
  SQS_RESERVED_HEADERS,
  SqsSenderAdapterOptions,
} from './sqs-adapter.interfaces';
import { resolveQueueUrl } from './sqs-queue-url.util';
import { assertSupportedDeliveryOptions } from '../abstract/sender/queue-delivery-options.util';

// SQS caps DelaySeconds at 15 minutes.
const MAX_DELAY_MS = 900_000;

@Injectable()
export class SqsSenderAdapter extends QueueSenderService {
  private readonly client: SQSClient;
  private readonly urlCache = new Map<string, string>();

  /**
   * Builds the SQS sender adapter and its underlying SQS client.
   *
   * @param {SqsSenderAdapterOptions} options - Connection configuration (region, optional endpoint, and
   *   credentials).
   */
  constructor(options: SqsSenderAdapterOptions) {
    super();

    // Prefer IAM roles in remote environments; explicit keys are an escape
    // hatch for local development. See secrets-manager-config.adapter for the
    // rationale behind this pattern.
    const credentials =
      options.accessKeyId && options.secretAccessKey
        ? {
            credentials: {
              accessKeyId: options.accessKeyId,
              secretAccessKey: options.secretAccessKey,
            },
          }
        : {};
    this.client = new SQSClient({
      region: options.region,
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      ...credentials,
    });
  }

  /**
   * Sends a payload to a queue with default delivery options.
   *
   * Convenience wrapper over {@link dispatch} for the common no-headers case.
   *
   * @param {string} queue - Destination queue name.
   * @param {unknown} payload - Message payload, serialized to JSON.
   * @returns {Promise<void>} Resolves once the message has been accepted by SQS.
   * @throws {QueueSenderError} If the queue URL cannot be resolved or the send fails.
   */
  async send(queue: string, payload: unknown): Promise<void> {
    await this.dispatch({ queue, payload });
  }

  /**
   * Dispatches a full envelope (payload, headers, and delivery options) to SQS.
   *
   * Honors the `delay` delivery option natively via DelaySeconds; priority is
   * unsupported. FIFO queues require a message-group-id header. Reserved headers
   * are mapped to SQS-native fields rather than message attributes.
   *
   * @param {QueueEnvelope} envelope - Queue envelope holding the destination, payload, headers,
   *   and delivery options.
   * @returns {Promise<void>} Resolves once the message has been accepted by SQS.
   * @throws {QueueSenderError} With code `DISPATCH_FAILED` for unsupported
   *   delivery options, a FIFO queue missing its group id, or a delay over the
   *   15 minute maximum; with code `SEND_FAILED` if the underlying send fails;
   *   with code `CONNECTION_FAILED` if the queue URL cannot be resolved.
   */
  async dispatch(envelope: QueueEnvelope): Promise<void> {
    const { queue, payload, headers = {}, options } = envelope;

    // SQS supports delay natively (DelaySeconds); priority has no equivalent.
    assertSupportedDeliveryOptions(options, ['delay'], 'SqsSenderAdapter');

    const queueUrl = await this._resolveUrl(queue);

    const groupId = headers[SQS_RESERVED_HEADERS.MESSAGE_GROUP_ID];
    const deduplicationId =
      headers[SQS_RESERVED_HEADERS.MESSAGE_DEDUPLICATION_ID];

    if (queue.endsWith('.fifo') && !groupId) {
      throw new QueueSenderError(
        QUEUE_SENDER_ERRORS.DISPATCH_FAILED,
        `FIFO queue "${queue}" requires a "${SQS_RESERVED_HEADERS.MESSAGE_GROUP_ID}" header`,
        { queue },
      );
    }

    const delaySeconds = this._resolveDelaySeconds(queue, options?.delay);

    try {
      await this.client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(payload),
          MessageAttributes: this._buildAttributes(headers),
          ...(delaySeconds !== undefined ? { DelaySeconds: delaySeconds } : {}),
          ...(groupId ? { MessageGroupId: groupId } : {}),
          ...(deduplicationId
            ? { MessageDeduplicationId: deduplicationId }
            : {}),
        }),
      );
    } catch (error) {
      this.logger.error({
        message: 'Failed to send message to SQS',
        data: { queue },
        error,
      });
      throw new QueueSenderError(
        QUEUE_SENDER_ERRORS.SEND_FAILED,
        `Failed to send message to queue "${queue}"`,
        { queue, cause: (error as Error).message },
      );
    }

    this.logger.debug({ message: 'Message sent to SQS', data: { queue } });
  }

  /**
   * Resolves and caches the URL for a queue name, wrapping any failure in a
   * sender-domain error.
   *
   * @param {string} queue - Queue name to resolve.
   * @returns {Promise<string>} The resolved SQS queue URL.
   * @throws {QueueSenderError} With code `CONNECTION_FAILED` if resolution fails.
   */
  private async _resolveUrl(queue: string): Promise<string> {
    try {
      return await resolveQueueUrl(this.client, queue, this.urlCache);
    } catch (error) {
      this.logger.error({
        message: 'Failed to resolve SQS queue URL',
        data: { queue },
        error,
      });
      throw new QueueSenderError(
        QUEUE_SENDER_ERRORS.CONNECTION_FAILED,
        `Failed to resolve URL for queue "${queue}"`,
        { queue, cause: (error as Error).message },
      );
    }
  }

  /**
   * Converts a millisecond delay into SQS DelaySeconds.
   *
   * SQS caps DelaySeconds at 15 minutes; note that FIFO queues reject the field
   * entirely.
   *
   * @param {string} queue - Destination queue name, used for error context.
   * @param {number | undefined} delay - Requested delay in milliseconds, or undefined for none.
   * @returns {number | undefined} The delay in seconds, or undefined when no delay was requested.
   * @throws {QueueSenderError} With code `DISPATCH_FAILED` if the delay exceeds
   *   the 15 minute maximum.
   */
  private _resolveDelaySeconds(
    queue: string,
    delay: number | undefined,
  ): number | undefined {
    if (delay === undefined) return undefined;
    if (delay > MAX_DELAY_MS) {
      throw new QueueSenderError(
        QUEUE_SENDER_ERRORS.DISPATCH_FAILED,
        `SQS delay for "${queue}" exceeds the 15 minute maximum`,
        { queue, delay },
      );
    }
    return Math.round(delay / 1000);
  }

  /**
   * Maps non-reserved envelope headers to SQS string message attributes.
   *
   * Reserved headers (group id, deduplication id) are skipped because they map
   * to SQS-native fields handled separately by {@link dispatch}.
   *
   * @param {Record<string, string>} headers - Envelope headers to translate.
   * @returns {Record<string, MessageAttributeValue>} The message attributes keyed by header name.
   */
  private _buildAttributes(
    headers: Record<string, string>,
  ): Record<string, MessageAttributeValue> {
    const reserved: string[] = Object.values(SQS_RESERVED_HEADERS);
    const attributes: Record<string, MessageAttributeValue> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (reserved.includes(key)) continue;
      attributes[key] = { DataType: 'String', StringValue: value };
    }
    return attributes;
  }
}
