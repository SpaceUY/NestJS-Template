import { Injectable } from '@nestjs/common';
import { ConfirmChannel } from 'amqplib';
import { randomUUID } from 'node:crypto';
import { QueueProducer } from '../abstract/queue-producer.service';
import { EnqueueOptions, EnqueueResult } from '../abstract/queue.interfaces';

@Injectable()
export class RabbitmqProducerService extends QueueProducer {
  constructor(
    private readonly channel: ConfirmChannel,
    private readonly queueName: string,
  ) {
    super();
  }

  async enqueue<T = unknown>(
    jobName: string,
    data: T,
    options?: EnqueueOptions,
  ): Promise<EnqueueResult> {
    const id = randomUUID();
    const payload = Buffer.from(JSON.stringify({ jobName, data }));
    const headers: Record<string, string | number> = {};

    if (options?.attempts !== undefined) {
      headers['x-attempts'] = options.attempts;
    }
    if (options?.delayMs !== undefined) {
      headers['x-delay-ms'] = options.delayMs;
    }
    if (options?.backoff) {
      headers['x-backoff-type'] = options.backoff.type;
      headers['x-backoff-delay-ms'] = options.backoff.delayMs;
    }

    // sendToQueue() on a confirm channel invokes this callback only once
    // the broker has acked (or nacked) the publish — enqueue() doesn't
    // resolve on the strength of a local socket write alone.
    await new Promise<void>((resolve, reject) => {
      this.channel.sendToQueue(
        this.queueName,
        payload,
        { persistent: true, messageId: id, headers },
        (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        },
      );
    });

    return { id };
  }
}
