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

  constructor(private readonly options: BullMqConsumerAdapterOptions) {
    super();
  }

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

  // BullMQ settles a job by the processor's outcome, so we map the context
  // contract onto resolve/throw: handler resolves → job completes (ack); handler
  // throws → job fails and retries per the job's attempts (nack). Explicit
  // ctx.nack throws; requeue:false throws UnrecoverableError so BullMQ skips any
  // remaining retry attempts.
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
