import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QueueProducer } from '../abstract/queue-producer.service';
import { EnqueueOptions, EnqueueResult } from '../abstract/queue.interfaces';
import { QUEUE_ERRORS, QueueError } from '../abstract/queue.error';

@Injectable()
export class BullmqProducerService extends QueueProducer {
  constructor(private readonly queue: Queue) {
    super();
  }

  async enqueue<T = unknown>(
    jobName: string,
    data: T,
    options?: EnqueueOptions,
  ): Promise<EnqueueResult> {
    try {
      const job = await this.queue.add(jobName, data, {
        attempts: options?.attempts,
        delay: options?.delayMs,
        backoff: options?.backoff
          ? { type: options.backoff.type, delay: options.backoff.delayMs }
          : undefined,
      });

      return { id: String(job.id) };
    } catch (error) {
      throw new QueueError(
        QUEUE_ERRORS.ENQUEUE_FAILED,
        `Failed to enqueue job "${jobName}" on BullMQ queue "${this.queue.name}"`,
        { jobName, cause: error instanceof Error ? error.message : error },
      );
    }
  }
}
