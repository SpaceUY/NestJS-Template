import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  SPACESHIP_NOTIFICATION_QUEUE,
  SPACESHIP_CREATED_JOB,
} from './notification.constants';
import { SpaceshipCreatedJobData } from './notification.types';
import { LoggerService } from '../../common/logger/abstract/logger.service';

@Injectable()
export class SpaceshipNotificationProducer {
  constructor(
    @InjectQueue(SPACESHIP_NOTIFICATION_QUEUE)
    private readonly queue: Queue<SpaceshipCreatedJobData>,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SpaceshipNotificationProducer.name);
  }

  async enqueueSpaceshipCreated(data: SpaceshipCreatedJobData): Promise<void> {
    const job = await this.queue.add(SPACESHIP_CREATED_JOB, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    this.logger.log({
      message: 'Spaceship-created notification enqueued',
      data: { spaceshipUuid: data.spaceshipUuid, jobId: job.id },
    });
  }
}
