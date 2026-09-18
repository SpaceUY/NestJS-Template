import { Module } from '@nestjs/common';
import { SpaceshipNotificationProducer } from './notification.producer';
import { QueuesModule } from '../../queues/queues.module';

// `SpaceshipNotificationProcessor` is not declared here: it is registered as
// a consumer handler inside `QueuesModule` (its `QueueConsumerModule.forRootAsync`
// call), which is also where it is actually instantiated. See
// src/queues/CLAUDE.md's "Rules" for why consumer registration is centralized
// there instead of per-feature.
@Module({
  imports: [QueuesModule],
  providers: [SpaceshipNotificationProducer],
  exports: [SpaceshipNotificationProducer],
})
export class SpaceshipNotificationQueueModule {}
