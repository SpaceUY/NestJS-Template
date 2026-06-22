import { Injectable, OnModuleDestroy } from '@nestjs/common';
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
// Default pause after a failed ReceiveMessage so transient broker errors don't
// hot-loop. Overridable via `receiveErrorBackoffMs`.
const DEFAULT_RECEIVE_ERROR_BACKOFF_MS = 1000;

type ConsumerCallback = (
  payload: unknown,
  ctx: MessageContext,
) => Promise<void>;

interface ActiveConsumer {
  controller: AbortController;
  loop: Promise<void>;
}

@Injectable()
export class SqsConsumerAdapter
  extends QueueConsumerAdapter
  implements OnModuleDestroy
{
  private readonly client: SQSClient;
  private readonly urlCache = new Map<string, string>();
  private readonly consumers = new Map<string, ActiveConsumer>();

  /**
   * Builds the SQS consumer adapter and its underlying SQS client.
   *
   * @param {SqsConsumerAdapterOptions} options - Connection and polling configuration (region, optional
   *   endpoint, credentials, and receive/visibility tuning).
   */
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

  /**
   * Starts a background polling loop that delivers messages from a queue to the
   * callback. Idempotent per queue: a second start for an already-consumed
   * queue is ignored.
   *
   * @param {string} queue - Queue name to consume from.
   * @param {ConsumerCallback} callback - Handler invoked with the parsed payload and message context.
   * @returns {Promise<void>} Resolves once the polling loop has been registered and started.
   * @throws {QueueConsumerError} With code `CONSUME_FAILED` if the queue URL
   *   cannot be resolved.
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

    const queueUrl = await this._resolveUrl(queue);
    const controller = new AbortController();
    const loop = this._consumeLoop(queueUrl, callback, controller.signal);

    this.consumers.set(queue, { controller, loop });
    this.logger.log({
      message: 'Started consuming SQS queue',
      data: { queue },
    });
  }

  /**
   * Stops consuming a queue, aborting the in-flight poll and awaiting the loop's
   * graceful exit. No-op if the queue is not currently being consumed.
   *
   * @param {string} queue - Queue name to stop consuming.
   * @returns {Promise<void>} Resolves once the polling loop has fully wound down.
   */
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

  /**
   * Stops every active poll loop and destroys the SQS client on module
   * teardown, releasing its pooled HTTP sockets.
   *
   * `QueueConsumerModule` already calls `stopConsuming` per registered queue;
   * stopping any remainder here keeps the adapter self-contained, and the
   * client is destroyed once all loops have wound down.
   *
   * @returns {Promise<void>} Resolves once all loops have stopped and the client is destroyed.
   */
  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.consumers.keys()].map((queue) => this.stopConsuming(queue)),
    );
    this.client.destroy();
  }

  /**
   * Long-running poll loop that repeatedly receives and handles messages until
   * the signal aborts. Receive failures are logged and followed by a backoff
   * delay so transient broker errors don't hot-loop.
   *
   * @param {string} queueUrl - Resolved SQS queue URL to poll.
   * @param {ConsumerCallback} callback - Handler invoked for each received message.
   * @param {AbortSignal} signal - Abort signal that terminates the loop.
   * @returns {Promise<void>} Resolves when the loop exits after the signal is aborted.
   */
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
        await this._delay(
          this.options.receiveErrorBackoffMs ??
            DEFAULT_RECEIVE_ERROR_BACKOFF_MS,
          signal,
        );
      }
    }
  }

  /**
   * Performs a single long-poll ReceiveMessage and processes the returned batch
   * serially.
   *
   * @param {string} queueUrl - Resolved SQS queue URL to poll.
   * @param {ConsumerCallback} callback - Handler invoked for each received message.
   * @param {AbortSignal} [signal] - Optional abort signal forwarded to the SDK call.
   * @returns {Promise<void>} Resolves once every message in the batch has been handled.
   */
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

    // Messages in a batch are processed serially by design: it keeps FIFO
    // message-group ordering intact (a batch can hold several ordered messages
    // from one group) and bounds in-flight work to one handler at a time. For
    // higher throughput, lower maxNumberOfMessages and run more consumers.
    for (const message of response.Messages ?? []) {
      await this._handleMessage(queueUrl, message, callback);
    }
  }

  /**
   * Runs the handler for a single message and applies the implicit ack/nack
   * contract.
   *
   * Acks on success and nacks on a thrown handler error, unless the handler
   * settled the message explicitly via the context. Failures to settle are
   * logged but never propagated, so the poll loop stays alive.
   *
   * @param {string} queueUrl - Resolved SQS queue URL the message came from.
   * @param {Message} message - Raw SQS message to process.
   * @param {ConsumerCallback} callback - Handler invoked with the parsed payload and message context.
   * @returns {Promise<void>} Resolves once the message has been handled and settled.
   */
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

  /**
   * Parses a message body as JSON, falling back to the raw string when it is
   * not valid JSON.
   *
   * @param {string | undefined} body - Raw SQS message body, or undefined when absent.
   * @returns {unknown} The parsed object, the original string, or undefined.
   */
  private _parseBody(body: string | undefined): unknown {
    if (body === undefined) return undefined;
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  /**
   * Resolves and caches the URL for a queue name, wrapping any failure in a
   * consumer-domain error.
   *
   * @param {string} queue - Queue name to resolve.
   * @returns {Promise<string>} The resolved SQS queue URL.
   * @throws {QueueConsumerError} With code `CONSUME_FAILED` if resolution fails.
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
      throw new QueueConsumerError(
        QUEUE_CONSUMER_ERRORS.CONSUME_FAILED,
        `Failed to resolve URL for queue "${queue}"`,
        { queue, cause: (error as Error).message },
      );
    }
  }

  /**
   * Waits for the given duration, resolving early if the signal aborts so the
   * loop can exit promptly during shutdown.
   *
   * @param {number} ms - Delay duration in milliseconds.
   * @param {AbortSignal} signal - Abort signal that short-circuits the wait.
   * @returns {Promise<void>} Resolves when the timer fires or the signal aborts.
   */
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
