import { Inject, Injectable } from '@nestjs/common';
import { QueueProducer } from '../../queues/abstract/queue-producer.service';
import { getQueueProducerToken } from '../../queues/abstract/queue.tokens';
import {
  SPACESHIP_NOTIFICATION_QUEUE,
  SPACESHIP_CREATED_JOB,
} from './notification.constants';
import { SpaceshipCreatedJobData } from './notification.types';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';

@Injectable()
export class SpaceshipNotificationProducer {
  constructor(
    @Inject(getQueueProducerToken(SPACESHIP_NOTIFICATION_QUEUE))
    private readonly queueProducer: QueueProducer,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SpaceshipNotificationProducer.name);
  }

  async enqueueSpaceshipCreated(data: SpaceshipCreatedJobData): Promise<void> {
    const result = await this.queueProducer.enqueue(
      SPACESHIP_CREATED_JOB,
      data,
      { attempts: 3, backoff: { type: 'exponential', delayMs: 5000 } },
    );

    this.logger.log({
      message: 'Spaceship-created notification enqueued',
      data: { spaceshipUuid: data.spaceshipUuid, jobId: result.id },
    });
  }
}
