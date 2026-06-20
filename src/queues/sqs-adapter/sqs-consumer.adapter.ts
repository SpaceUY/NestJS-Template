import { Injectable } from '@nestjs/common';
import { Message, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { QueueConsumerAdapter } from '../abstract/consumer/queue-consumer.adapter';
import { MessageContext } from '../abstract/consumer/queue-consumer.interfaces';
import {
  QueueConsumerError,
  QUEUE_CONSUMER_ERRORS,
} from '../abstract/consumer/queue-consumer.error';
import { SqsConsumerAdapterOptions } from './sqs-adapter.interfaces';
import { SqsMessageContext } from './sqs-message.context';
import { resolveQueueUrl } from './sqs-queue-url.util';

const DEFAULT_WAIT_TIME_SECONDS = 20;
const DEFAULT_MAX_MESSAGES = 10;
// Pause after a failed ReceiveMessage so transient broker errors don't hot-loop.
const RECEIVE_ERROR_BACKOFF_MS = 1000;

type ConsumerCallback = (
  payload: unknown,
  ctx: MessageContext,
) => Promise<void>;

interface ActiveConsumer {
  controller: AbortController;
  loop: Promise<void>;
}

@Injectable()
export class SqsConsumerAdapter extends QueueConsumerAdapter {
  private readonly client: SQSClient;
  private readonly urlCache = new Map<string, string>();
  private readonly consumers = new Map<string, ActiveConsumer>();

  constructor(private readonly options: SqsConsumerAdapterOptions) {
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

    const queueUrl = await this._resolveUrl(queue);
    const controller = new AbortController();
    const loop = this._consumeLoop(queueUrl, callback, controller.signal);

    this.consumers.set(queue, { controller, loop });
    this.logger.log({
      message: 'Started consuming SQS queue',
      data: { queue },
    });
  }

  async stopConsuming(queue: string): Promise<void> {
    const active = this.consumers.get(queue);
    if (!active) return;

    active.controller.abort();
    this.consumers.delete(queue);
    await active.loop;
    this.logger.log({
      message: 'Stopped consuming SQS queue',
      data: { queue },
    });
  }

  private async _consumeLoop(
    queueUrl: string,
    callback: ConsumerCallback,
    signal: AbortSignal,
  ): Promise<void> {
    while (!signal.aborted) {
      try {
        await this._pollOnce(queueUrl, callback, signal);
      } catch (error) {
        if (signal.aborted) break;
        this.logger.error({
          message: 'Failed to receive messages from SQS',
          data: { queueUrl },
          error,
        });
        await this._delay(RECEIVE_ERROR_BACKOFF_MS, signal);
      }
    }
  }

  private async _pollOnce(
    queueUrl: string,
    callback: ConsumerCallback,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages:
          this.options.maxNumberOfMessages ?? DEFAULT_MAX_MESSAGES,
        WaitTimeSeconds:
          this.options.waitTimeSeconds ?? DEFAULT_WAIT_TIME_SECONDS,
        MessageAttributeNames: ['All'],
        MessageSystemAttributeNames: ['ApproximateReceiveCount'],
        ...(this.options.visibilityTimeout !== undefined
          ? { VisibilityTimeout: this.options.visibilityTimeout }
          : {}),
      }),
      signal ? { abortSignal: signal } : {},
    );

    for (const message of response.Messages ?? []) {
      await this._handleMessage(queueUrl, message, callback);
    }
  }

  // Runs the handler for a single message and applies the implicit ack/nack
  // contract: ack on success, nack on throw, unless the handler settled the
  // message explicitly via the context.
  private async _handleMessage(
    queueUrl: string,
    message: Message,
    callback: ConsumerCallback,
  ): Promise<void> {
    const ctx = new SqsMessageContext(this.client, queueUrl, message);
    const payload = this._parseBody(message.Body);

    let handlerError: unknown;
    try {
      await callback(payload, ctx);
    } catch (error) {
      handlerError = error;
      this.logger.error({
        message: 'Queue handler threw while processing SQS message',
        data: { messageId: message.MessageId },
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
      // ctx surfaces ACK_FAILED / NACK_FAILED; log and keep the loop alive.
      const code =
        settleError instanceof QueueConsumerError
          ? settleError.code
          : QUEUE_CONSUMER_ERRORS.CONSUME_FAILED;
      this.logger.error({
        message: 'Failed to settle SQS message',
        data: { messageId: message.MessageId, code },
        error: settleError,
      });
    }
  }

  private _parseBody(body: string | undefined): unknown {
    if (body === undefined) return undefined;
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
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
      throw new QueueConsumerError(
        QUEUE_CONSUMER_ERRORS.CONSUME_FAILED,
        `Failed to resolve URL for queue "${queue}"`,
        { queue, cause: (error as Error).message },
      );
    }
  }

  private _delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const onAbort = (): void => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}
