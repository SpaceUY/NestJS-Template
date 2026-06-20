import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import { QueueSenderService } from '../abstract/sender/queue-sender.service';
import { QueueEnvelope } from '../abstract/sender/queue-sender.interfaces';
import {
  QueueSenderError,
  QUEUE_SENDER_ERRORS,
} from '../abstract/sender/queue-sender.error';
import { assertSupportedDeliveryOptions } from '../abstract/sender/queue-delivery-options.util';
import {
  BullMqAddJobParams,
  BullMqSenderAdapterOptions,
} from './bullmq-adapter.interfaces';

// BullMQ requires a job name; the worker processes all names regardless. This
// default keeps it readable in the BullMQ dashboard; override via `jobName`.
const DEFAULT_JOB_NAME = 'message';

@Injectable()
export class BullMqSenderAdapter
  extends QueueSenderService
  implements OnModuleDestroy
{
  private readonly queues = new Map<string, Queue>();

  /**
   * Creates the adapter with the BullMQ queue configuration.
   *
   * @param {BullMqSenderAdapterOptions} options - Connection, prefix, and optional job-name settings used when creating queues.
   */
  constructor(private readonly options: BullMqSenderAdapterOptions) {
    super();
  }

  /**
   * Sends a payload to a queue with default delivery options.
   *
   * Convenience wrapper over {@link dispatch} for the common no-options case.
   *
   * @param {string} queue - Name of the destination queue.
   * @param {unknown} payload - The message body to enqueue.
   * @returns {Promise<void>} Resolves once the job has been enqueued.
   * @throws {QueueSenderError} With code SEND_FAILED if enqueuing fails.
   */
  async send(queue: string, payload: unknown): Promise<void> {
    await this.dispatch({ queue, payload });
  }

  /**
   * Dispatches an envelope to a queue, applying the supported abstract delivery options.
   *
   * Only `delay` and `priority` are supported; any other delivery option causes a rejection
   * before enqueuing.
   *
   * @param {QueueEnvelope} envelope - Queue name, payload, optional headers, and delivery options.
   * @returns {Promise<void>} Resolves once the job has been enqueued.
   * @throws {QueueSenderError} With code SEND_FAILED if enqueuing fails, or if unsupported delivery options are provided.
   */
  async dispatch(envelope: QueueEnvelope): Promise<void> {
    const { queue, payload, headers = {}, options } = envelope;

    // BullMQ supports both shared delivery options natively.
    assertSupportedDeliveryOptions(
      options,
      ['delay', 'priority'],
      'BullMqSenderAdapter',
    );

    const jobOptions: JobsOptions = {
      ...(options?.delay !== undefined ? { delay: options.delay } : {}),
      ...(options?.priority !== undefined
        ? { priority: options.priority }
        : {}),
    };

    await this._enqueue(queue, payload, headers, jobOptions);
  }

  /**
   * BullMQ-specific extension: enqueue a job with the full set of supported
   * BullMQ options (attempts, backoff, jobId, …) that go beyond the abstract
   * delivery options. Inject this concrete adapter to use it.
   *
   * @param {BullMqAddJobParams} params - Queue name, payload, optional headers, and native BullMQ job options.
   * @returns {Promise<void>} Resolves once the job has been enqueued.
   * @throws {QueueSenderError} With code SEND_FAILED if enqueuing fails.
   */
  async addJob(params: BullMqAddJobParams): Promise<void> {
    const { queue, payload, headers = {}, options = {} } = params;
    await this._enqueue(queue, payload, headers, options);
  }

  /**
   * Closes all cached queue connections on module teardown.
   *
   * @returns {Promise<void>} Resolves once every queue has been closed and the cache cleared.
   */
  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.queues.clear();
  }

  /**
   * Wraps the payload in an envelope and adds it as a job to the queue.
   *
   * Failures are logged and converted into a domain error rather than surfacing the raw BullMQ error.
   *
   * @param {string} queue - Name of the destination queue.
   * @param {unknown} payload - The message body to enqueue.
   * @param {Record<string, string>} headers - Header metadata stored alongside the payload.
   * @param {JobsOptions} options - Native BullMQ job options to apply.
   * @returns {Promise<void>} Resolves once the job has been enqueued.
   * @throws {QueueSenderError} With code SEND_FAILED if the underlying enqueue call fails.
   */
  private async _enqueue(
    queue: string,
    payload: unknown,
    headers: Record<string, string>,
    options: JobsOptions,
  ): Promise<void> {
    try {
      await this._getQueue(queue).add(
        this.options.jobName ?? DEFAULT_JOB_NAME,
        { payload, headers },
        options,
      );
    } catch (error) {
      this.logger.error({
        message: 'Failed to enqueue BullMQ job',
        data: { queue },
        error,
      });
      throw new QueueSenderError(
        QUEUE_SENDER_ERRORS.SEND_FAILED,
        `Failed to enqueue job to "${queue}"`,
        { queue, cause: (error as Error).message },
      );
    }

    this.logger.debug({ message: 'Job enqueued to BullMQ', data: { queue } });
  }

  /**
   * Returns the cached `Queue` for a name, lazily creating and caching it on first use.
   *
   * @param {string} name - Name of the queue to retrieve or create.
   * @returns {Queue} The `Queue` instance bound to the configured connection and prefix.
   */
  private _getQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: this.options.connection,
        prefix: this.options.prefix,
      });
      this.queues.set(name, queue);
    }
    return queue;
  }
}
