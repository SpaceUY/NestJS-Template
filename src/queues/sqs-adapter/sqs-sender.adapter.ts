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
    const { queue, payload, headers = {} } = envelope;

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

    try {
      await this.client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(payload),
          MessageAttributes: this._buildAttributes(headers),
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
