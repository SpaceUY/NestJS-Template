import { Injectable } from '@nestjs/common';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import { QueueConsumerAdapter } from '../abstract/consumer/queue-consumer.adapter';
import { MessageContext } from '../abstract/consumer/queue-consumer.interfaces';
import {
  QueueConsumerError,
  QUEUE_CONSUMER_ERRORS,
} from '../abstract/consumer/queue-consumer.error';
import {
  BullMqConsumerAdapterOptions,
  BullMqJobEnvelope,
} from './bullmq-adapter.interfaces';
import { BullMqMessageContext } from './bullmq-message.context';

type ConsumerCallback = (
  payload: unknown,
  ctx: MessageContext,
) => Promise<void>;

@Injectable()
export class BullMqConsumerAdapter extends QueueConsumerAdapter {
  private readonly workers = new Map<string, Worker>();

  /**
   * Creates the adapter with the BullMQ worker configuration.
   *
   * @param {BullMqConsumerAdapterOptions} options - Connection, prefix, and concurrency settings used to spin up workers per queue.
   */
  constructor(private readonly options: BullMqConsumerAdapterOptions) {
    super();
  }

  /**
   * Starts a BullMQ worker that processes jobs from the given queue.
   *
   * Idempotent per queue: a second start for an already-consumed queue is logged and ignored.
   *
   * @param {string} queue - Name of the queue to consume from.
   * @param {ConsumerCallback} callback - Handler invoked with the unwrapped payload and message context for each job.
   * @returns {Promise<void>} Resolves once the worker has been created and registered.
   * @throws {QueueConsumerError} With code CONSUME_FAILED if the worker cannot be created.
   */
  async startConsuming(
    queue: string,
    callback: ConsumerCallback,
  ): Promise<void> {
    if (this.workers.has(queue)) {
      this.logger.warn({
        message: 'Already consuming queue; ignoring duplicate start',
        data: { queue },
      });
      return;
    }

    let worker: Worker;
    try {
      worker = new Worker(queue, (job) => this._process(job, callback), {
        connection: this.options.connection,
        prefix: this.options.prefix,
        concurrency: this.options.concurrency,
      });
    } catch (error) {
      throw this._consumeError(queue, error);
    }

    worker.on('error', (error) =>
      this.logger.error({
        message: 'BullMQ worker error',
        data: { queue },
        error,
      }),
    );

    this.workers.set(queue, worker);
    this.logger.log({
      message: 'Started consuming BullMQ queue',
      data: { queue },
    });
  }

  /**
   * Stops consuming the given queue and closes its worker.
   *
   * No-op if the queue is not currently being consumed.
   *
   * @param {string} queue - Name of the queue to stop consuming.
   * @returns {Promise<void>} Resolves once the worker has been closed and deregistered.
   */
  async stopConsuming(queue: string): Promise<void> {
    const worker = this.workers.get(queue);
    if (!worker) return;

    this.workers.delete(queue);
    await worker.close();
    this.logger.log({
      message: 'Stopped consuming BullMQ queue',
      data: { queue },
    });
  }

  /**
   * BullMQ job processor that bridges the context's ack/nack intent onto BullMQ's resolve/throw model.
   *
   * BullMQ settles a job by the processor's outcome, so the context contract is mapped onto resolve/throw:
   * the handler resolving completes the job (ack); the handler throwing fails the job and retries per its
   * configured attempts (nack). An explicit `ctx.nack` throws; `requeue:false` throws `UnrecoverableError`
   * so BullMQ skips any remaining retry attempts.
   *
   * @param {Job} job - The BullMQ job being processed.
   * @param {ConsumerCallback} callback - The consumer handler to invoke with the unwrapped payload and context.
   * @returns {Promise<void>} Resolves when the handler completes successfully and did not nack.
   * @throws The error thrown by the handler, propagated so BullMQ fails and retries the job.
   * @throws {Error} If the handler nacked with `requeue:true`, signaling a retry.
   * @throws {UnrecoverableError} If the handler nacked with `requeue:false`, skipping remaining retries.
   */
  private async _process(job: Job, callback: ConsumerCallback): Promise<void> {
    const { payload, headers } = this._unwrap(job);
    const ctx = new BullMqMessageContext(job, headers);

    try {
      await callback(payload, ctx);
    } catch (error) {
      this.logger.error({
        message: 'Queue handler threw while processing BullMQ job',
        data: { jobId: job.id },
        error,
      });
      throw error;
    }

    if (ctx.nacked) {
      if (!ctx.requeue) {
        throw new UnrecoverableError(`Job "${job.id}" nacked without requeue`);
      }
      throw new Error(`Job "${job.id}" nacked for retry`);
    }
  }

  /**
   * Extracts the payload and headers from a job's data.
   *
   * Jobs enqueued by this adapter carry a `{ payload, headers }` envelope; jobs enqueued elsewhere
   * are not wrapped, so the entire job data is treated as the payload with empty headers.
   *
   * @param {Job} job - The BullMQ job whose data should be unwrapped.
   * @returns {BullMqJobEnvelope} The job's payload and headers.
   */
  private _unwrap(job: Job): BullMqJobEnvelope {
    const data: unknown = job.data;
    if (data && typeof data === 'object' && 'payload' in data) {
      const envelope = data as Partial<BullMqJobEnvelope>;
      return { payload: envelope.payload, headers: envelope.headers ?? {} };
    }
    // Jobs enqueued outside this adapter aren't wrapped — treat the whole
    // data as the payload.
    return { payload: data, headers: {} };
  }

  /**
   * Logs a consumer startup failure and wraps it in a domain error.
   *
   * @param {string} queue - Name of the queue whose consumer failed to start.
   * @param {unknown} error - The underlying error raised while creating the worker.
   * @returns {QueueConsumerError} A `QueueConsumerError` with code CONSUME_FAILED carrying the original cause.
   */
  private _consumeError(queue: string, error: unknown): QueueConsumerError {
    this.logger.error({
      message: 'Failed to start BullMQ consumer',
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
