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

  async send(queue: string, payload: unknown): Promise<void> {
    await this.dispatch({ queue, payload });
  }

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

  // FIFO queues reject DelaySeconds, and SQS caps it at 15 minutes.
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

  // Maps non-reserved envelope headers to SQS string message attributes.
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
