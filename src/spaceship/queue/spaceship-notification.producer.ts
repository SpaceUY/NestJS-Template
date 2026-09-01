import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  SPACESHIP_NOTIFICATION_QUEUE,
  SPACESHIP_CREATED_JOB,
} from './spaceship-notification.constants';
import { SpaceshipCreatedJobData } from './spaceship-notification.types';

@Injectable()
export class SpaceshipNotificationProducer {
  constructor(
    @InjectQueue(SPACESHIP_NOTIFICATION_QUEUE)
    private readonly queue: Queue<SpaceshipCreatedJobData>,
  ) {}

  async enqueueSpaceshipCreated(data: SpaceshipCreatedJobData): Promise<void> {
    await this.queue.add(SPACESHIP_CREATED_JOB, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
}
