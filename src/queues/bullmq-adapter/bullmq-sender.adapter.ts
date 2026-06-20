import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QueueSenderService } from '../abstract/sender/queue-sender.service';
import { QueueEnvelope } from '../abstract/sender/queue-sender.interfaces';
import {
  QueueSenderError,
  QUEUE_SENDER_ERRORS,
} from '../abstract/sender/queue-sender.error';
import { BullMqSenderAdapterOptions } from './bullmq-adapter.interfaces';

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
    const { queue, payload, headers = {} } = envelope;

    try {
      await this._getQueue(queue).add(JOB_NAME, { payload, headers });
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

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.queues.clear();
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
