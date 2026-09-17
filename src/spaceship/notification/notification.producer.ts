import { Injectable } from '@nestjs/common';
import { BullMqSenderAdapter } from '../../queues/bullmq-adapter/bullmq-sender.adapter';
import {
  SPACESHIP_NOTIFICATION_QUEUE,
  SPACESHIP_CREATED_JOB,
} from './notification.constants';
import { SpaceshipCreatedJobData } from './notification.types';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';

@Injectable()
export class SpaceshipNotificationProducer {
  constructor(
    // Concrete adapter, not the abstract QueueSenderService: the abstract
    // `dispatch()` only supports broker-agnostic delay/priority, not the
    // BullMQ-specific attempts/backoff this notification relies on. See
    // src/queues/CLAUDE.md's "Rules".
    private readonly sender: BullMqSenderAdapter,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SpaceshipNotificationProducer.name);
  }

  async enqueueSpaceshipCreated(data: SpaceshipCreatedJobData): Promise<void> {
    await this.sender.addJob({
      queue: SPACESHIP_NOTIFICATION_QUEUE,
      payload: data,
      headers: { jobType: SPACESHIP_CREATED_JOB },
      options: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    });

    this.logger.log({
      message: 'Spaceship-created notification enqueued',
      data: { spaceshipUuid: data.spaceshipUuid },
    });
  }
}
