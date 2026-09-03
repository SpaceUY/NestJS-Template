import { EnqueueOptions, EnqueueResult } from './queue.interfaces';

export abstract class QueueProducer {
  abstract enqueue<T = unknown>(
    jobName: string,
    data: T,
    options?: EnqueueOptions,
  ): Promise<EnqueueResult>;
}
