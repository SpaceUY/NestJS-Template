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

// BullMQ requires a job name; the worker processes all names, so a constant
// keeps it simple while remaining readable in the BullMQ dashboard.
const JOB_NAME = 'message';

@Injectable()
export class BullMqSenderAdapter
  extends QueueSenderService
  implements OnModuleDestroy
{
  private readonly queues = new Map<string, Queue>();

  constructor(private readonly options: BullMqSenderAdapterOptions) {
    super();
  }

  async send(queue: string, payload: unknown): Promise<void> {
    await this.dispatch({ queue, payload });
  }

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
   */
  async addJob(params: BullMqAddJobParams): Promise<void> {
    const { queue, payload, headers = {}, options = {} } = params;
    await this._enqueue(queue, payload, headers, options);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.queues.clear();
  }

  private async _enqueue(
    queue: string,
    payload: unknown,
    headers: Record<string, string>,
    options: JobsOptions,
  ): Promise<void> {
    try {
      await this._getQueue(queue).add(JOB_NAME, { payload, headers }, options);
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
